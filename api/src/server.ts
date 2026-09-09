import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import dotenv from "dotenv";
import { pool, healthCheck } from "./db.js";
import { attachTrlRoutes } from "./trl.js";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

attachTrlRoutes(app);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = process.env.STATIC_DIR || path.join(__dirname, "..", "web-dist");
const paperStaticDir = process.env.PAPER_STATIC_DIR || path.join(__dirname, "..", "paper-dist");
app.use(express.static(staticDir));
app.use("/scimanage-papers", express.static(paperStaticDir));

function wantsHtml(req: express.Request) {
  const accept = req.headers.accept;
  return typeof accept === "string" && accept.includes("text/html");
}

function sendAppShell(res: express.Response) {
  return res.sendFile(path.join(staticDir, "index.html"));
}

app.get("/config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(
    `window.__APP_CONFIG__ = ${JSON.stringify({
      VITE_API_URL: process.env.VITE_API_URL || "",
      VITE_GOOGLE_CLIENT_ID: process.env.VITE_GOOGLE_CLIENT_ID || "",
    })};`
  );
});

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

const RESEARCH_LINE_LABELS: Record<string, string> = {
  "Cambio climatico": "Cambio climático",
  "Energias renovables": "Energías renovables",
  "Tecnologias para la educacion": "Tecnologías para la educación",
  "Emprendedurismo e innovacion": "Emprendedurismo e innovación",
  "Salud publica": "Salud pública",
  "Gestion y politicas publicas": "Gestión y políticas públicas",
};

const ODS_BY_RESEARCH_LINE: Record<string, string[]> = {
  "Cambio climático": ["ODS 13", "ODS 11", "ODS 2"],
  "Energías renovables": ["ODS 7"],
  "Tecnologías para la educación": ["ODS 4", "ODS 3", "ODS 1", "ODS 17"],
  "Emprendedurismo e innovación": ["ODS 9", "ODS 17"],
  "Salud pública": ["ODS 3"],
  "Gestión y políticas públicas": ["ODS 3", "ODS 5", "ODS 8", "ODS 10", "ODS 1"],
};

function formatResearchLine(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "Sin línea";
  return RESEARCH_LINE_LABELS[raw] || raw;
}

function getResearchLineOds(researchLine: unknown) {
  return ODS_BY_RESEARCH_LINE[formatResearchLine(researchLine)] || [];
}

function normalizeProjectOds(value: unknown, researchLine: unknown) {
  const relatedOds = getResearchLineOds(researchLine);
  const allowed = new Set(relatedOds);
  const selected = safeJsonArray(value)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^ODS\s+\d+$/.test(item))
    .map((item) => item.replace(/\s+/, " "));

  const filtered = selected.filter((item) => allowed.size === 0 || allowed.has(item));
  return Array.from(new Set(filtered.length ? filtered : relatedOds));
}

function buildOdsByResearchLineFromProjects(rows: { research_line?: string | null; ods_json?: unknown }[]) {
  const totals = new Map<string, { research_line: string; ods: string; total: number }>();

  for (const row of rows) {
    const line = formatResearchLine(row.research_line);
    const relatedOds = getResearchLineOds(line);
    for (const ods of relatedOds) {
      const key = `${line}::${ods}`;
      if (!totals.has(key)) totals.set(key, { research_line: line, ods, total: 0 });
    }

    for (const ods of normalizeProjectOds(row.ods_json, line)) {
      const key = `${line}::${ods}`;
      const current = totals.get(key) || { research_line: line, ods, total: 0 };
      current.total += 1;
      totals.set(key, current);
    }
  }

  return Array.from(totals.values()).sort((a, b) => {
    const lineCompare = a.research_line.localeCompare(b.research_line, "es");
    if (lineCompare !== 0) return lineCompare;
    return Number(a.ods.replace(/\D/g, "")) - Number(b.ods.replace(/\D/g, ""));
  });
}

function validCampusCondition(alias: string) {
  return `NULLIF(TRIM(${alias}.campus), '') IS NOT NULL AND LOWER(TRIM(${alias}.campus)) <> 'sin sede'`;
}

function validCareerCondition(alias: string) {
  return `NULLIF(TRIM(${alias}.career), '') IS NOT NULL AND LOWER(TRIM(${alias}.career)) <> 'sin carrera'`;
}

function reportableProjectCondition(projectAlias: string) {
  return `EXISTS (
    SELECT 1
    FROM project_members report_pm
    JOIN users report_u ON report_u.id = report_pm.user_id
    WHERE report_pm.project_id = ${projectAlias}.id
      AND report_u.role = 'student'
      AND ${validCampusCondition("report_u")}
      AND ${validCareerCondition("report_u")}
  )
  AND EXISTS (
    SELECT 1
    FROM users report_owner
    WHERE report_owner.id = ${projectAlias}.student_id
      AND report_owner.role = 'student'
      AND ${validCareerCondition("report_owner")}
  )`;
}

function hasCampusValue(value: unknown) {
  const raw = String(value || "").trim();
  return Boolean(raw && raw.toLowerCase() !== "sin sede");
}

async function getAdminUserIds() {
  const [rows] = await pool.query("SELECT id FROM users WHERE role = 'admin'");
  if (!Array.isArray(rows)) return [] as string[];
  return rows.map((r: any) => r.id).filter(Boolean);
}

async function notifyUsers(userIds: string[], payload: { projectId?: string; type: string; message: string }) {
  if (!userIds.length) return;
  const rows = userIds.map(() => "(?, ?, ?, ?, ?)").join(",");
  const params = userIds.flatMap((id) => [uuid(), id, payload.projectId || null, payload.type, payload.message]);
  await pool.query(`INSERT INTO notifications (id, user_id, project_id, type, message) VALUES ${rows}`, params);
}

type ScimanagePaperPayload = {
  id: string;
  titulo: string;
  integrantes: number;
  sede: string;
  ods: string[];
  lineaInvestigacion: string;
  paisRevista: string;
  status: "en_proceso" | "finalizado";
  linkRevista: string;
  pagoStatus: "pendiente" | "pagado";
  pagoDriveUrl: string;
  pagoMontoPen: number;
  createdAt: string;
  updatedAt: string;
};

type ScimanagePatentPayload = {
  id: string;
  nombre: string;
  inventor: string;
  sede: string;
  categoria: "modelo_inventiva" | "modelo_utilidad" | "diseno_industrial";
  status: "inicio" | "en_proceso" | "finalizado";
  link: string;
  numeroExpediente: string;
  fechaSolicitud: string;
  createdAt: string;
  updatedAt: string;
};

const SCIMANAGE_SEED_PAPERS: ScimanagePaperPayload[] = [
  {
    id: "pp-001",
    titulo: "Análisis de datos abiertos para movilidad urbana",
    integrantes: 3,
    sede: "Lima",
    ods: ["ODS 13", "ODS 11", "ODS 2"],
    lineaInvestigacion: "Cambio climático",
    paisRevista: "Colombia",
    status: "finalizado",
    linkRevista: "https://revistas.example.com/urban-mobility",
    pagoStatus: "pagado",
    pagoDriveUrl: "https://drive.google.com/example-proof-1",
    pagoMontoPen: 0,
    createdAt: "2025-08-19T14:05:00.000Z",
    updatedAt: "2025-08-22T10:12:00.000Z",
  },
  {
    id: "pp-002",
    titulo: "Detección temprana de erosión en suelos agrícolas",
    integrantes: 4,
    sede: "Huancayo",
    ods: ["ODS 7"],
    lineaInvestigacion: "Energías renovables",
    paisRevista: "Mexico",
    status: "en_proceso",
    linkRevista: "https://revistas.example.com/soil-erosion",
    pagoStatus: "pendiente",
    pagoDriveUrl: "",
    pagoMontoPen: 0,
    createdAt: "2025-10-05T10:20:00.000Z",
    updatedAt: "2025-10-05T10:20:00.000Z",
  },
];

const SCIMANAGE_SEED_PATENTS: ScimanagePatentPayload[] = [
  {
    id: "pt-001",
    nombre: "Sistema de captura solar modular para zonas rurales",
    inventor: "Maria Quispe",
    sede: "Arequipa",
    categoria: "modelo_inventiva",
    status: "en_proceso",
    link: "https://patentes.example.com/solar-modular",
    numeroExpediente: "PE-2025-00123",
    fechaSolicitud: "2025-05-12",
    createdAt: "2025-09-12T10:20:00.000Z",
    updatedAt: "2025-09-12T10:20:00.000Z",
  },
  {
    id: "pt-002",
    nombre: "Plataforma de aprendizaje adaptativo con IA",
    inventor: "Luis Medina",
    sede: "Cusco",
    categoria: "modelo_utilidad",
    status: "finalizado",
    link: "https://patentes.example.com/ia-adaptativo",
    numeroExpediente: "PE-2024-00877",
    fechaSolicitud: "2024-11-18",
    createdAt: "2025-06-10T08:30:00.000Z",
    updatedAt: "2025-07-01T09:00:00.000Z",
  },
];

function toMysqlDateTime(value?: string) {
  const source = value ? new Date(value) : new Date();
  const safe = Number.isNaN(source.getTime()) ? new Date() : source;
  return safe.toISOString().slice(0, 19).replace("T", " ");
}

function toDateOnly(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  const trimmed = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function safeJsonArray(value: any): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapScimanagePaper(row: any): ScimanagePaperPayload {
  return {
    id: String(row.id),
    titulo: String(row.titulo || ""),
    integrantes: Number(row.integrantes || 0),
    sede: String(row.sede || ""),
    ods: safeJsonArray(row.ods_json),
    lineaInvestigacion: String(row.linea_investigacion || ""),
    paisRevista: String(row.pais_revista || ""),
    status: row.status === "finalizado" ? "finalizado" : "en_proceso",
    linkRevista: String(row.link_revista || ""),
    pagoStatus: row.pago_status === "pagado" ? "pagado" : "pendiente",
    pagoDriveUrl: String(row.pago_drive_url || ""),
    pagoMontoPen: Number(row.pago_monto_pen || 0),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

function mapScimanagePatent(row: any): ScimanagePatentPayload {
  const categoria =
    row.categoria === "modelo_utilidad" || row.categoria === "diseno_industrial" ? row.categoria : "modelo_inventiva";
  const status = row.status === "finalizado" || row.status === "en_proceso" ? row.status : "inicio";
  return {
    id: String(row.id),
    nombre: String(row.nombre || ""),
    inventor: String(row.inventor || ""),
    sede: String(row.sede || ""),
    categoria,
    status,
    link: String(row.link || ""),
    numeroExpediente: String(row.numero_expediente || ""),
    fechaSolicitud: row.fecha_solicitud ? toDateOnly(String(row.fecha_solicitud)) : "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

async function ensureScimanageTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scimanage_papers (
      id VARCHAR(64) PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      integrantes INT NOT NULL DEFAULT 1,
      sede VARCHAR(120) NOT NULL,
      ods_json JSON NOT NULL,
      linea_investigacion VARCHAR(255) NOT NULL,
      pais_revista VARCHAR(120) NOT NULL,
      status ENUM('en_proceso','finalizado') NOT NULL DEFAULT 'en_proceso',
      link_revista TEXT,
      pago_status ENUM('pendiente','pagado') NOT NULL DEFAULT 'pendiente',
      pago_drive_url TEXT,
      pago_monto_pen DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    )
  `);

  const [paperAmountColumns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'scimanage_papers'
       AND COLUMN_NAME = 'pago_monto_pen'
     LIMIT 1`
  );
  if (!Array.isArray(paperAmountColumns) || paperAmountColumns.length === 0) {
    await pool.query("ALTER TABLE scimanage_papers ADD COLUMN pago_monto_pen DECIMAL(10,2) NOT NULL DEFAULT 0");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scimanage_patents (
      id VARCHAR(64) PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      inventor VARCHAR(255) NOT NULL,
      sede VARCHAR(120) NOT NULL,
      categoria ENUM('modelo_inventiva','modelo_utilidad','diseno_industrial') NOT NULL,
      status ENUM('inicio','en_proceso','finalizado') NOT NULL DEFAULT 'inicio',
      link TEXT,
      numero_expediente VARCHAR(120) NOT NULL,
      fecha_solicitud DATE NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    )
  `);

  const [[paperTotal]] = (await pool.query("SELECT COUNT(*) as total FROM scimanage_papers")) as any;
  if (!Number(paperTotal?.total || 0)) {
    for (const paper of SCIMANAGE_SEED_PAPERS) {
      await pool.query(
        `INSERT INTO scimanage_papers (
          id, titulo, integrantes, sede, ods_json, linea_investigacion, pais_revista, status,
          link_revista, pago_status, pago_drive_url, pago_monto_pen, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paper.id,
          paper.titulo,
          paper.integrantes,
          paper.sede,
          JSON.stringify(paper.ods),
          paper.lineaInvestigacion,
          paper.paisRevista,
          paper.status,
          paper.linkRevista || "",
          paper.pagoStatus,
          paper.pagoDriveUrl || "",
          paper.pagoMontoPen || 0,
          toMysqlDateTime(paper.createdAt),
          toMysqlDateTime(paper.updatedAt),
        ]
      );
    }
  }

  const [[patentTotal]] = (await pool.query("SELECT COUNT(*) as total FROM scimanage_patents")) as any;
  if (!Number(patentTotal?.total || 0)) {
    for (const patent of SCIMANAGE_SEED_PATENTS) {
      await pool.query(
        `INSERT INTO scimanage_patents (
          id, nombre, inventor, sede, categoria, status, link, numero_expediente, fecha_solicitud, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patent.id,
          patent.nombre,
          patent.inventor,
          patent.sede,
          patent.categoria,
          patent.status,
          patent.link || "",
          patent.numeroExpediente,
          toDateOnly(patent.fechaSolicitud),
          toMysqlDateTime(patent.createdAt),
          toMysqlDateTime(patent.updatedAt),
        ]
      );
    }
  }
}

async function ensureTaskProjectActiveColumn() {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'task_projects'
       AND COLUMN_NAME = 'active'
     LIMIT 1`
  );
  if (Array.isArray(columns) && columns.length > 0) return;

  try {
    await pool.query("ALTER TABLE task_projects ADD COLUMN active TINYINT(1) DEFAULT 0");
  } catch (err: any) {
    if (err?.code !== "ER_DUP_FIELDNAME") throw err;
  }
  await pool.query("UPDATE task_projects tp JOIN tasks t ON t.id = tp.task_id SET tp.active = t.active");
}

async function ensureProjectsOdsColumn() {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'projects'
       AND COLUMN_NAME = 'ods_json'
     LIMIT 1`
  );
  if (Array.isArray(columns) && columns.length > 0) return;

  try {
    await pool.query("ALTER TABLE projects ADD COLUMN ods_json JSON");
  } catch (err: any) {
    if (err?.code !== "ER_DUP_FIELDNAME") throw err;
  }
}

async function ensureGlobalTaskAssignments(projectId?: string) {
  await ensureTaskProjectActiveColumn();
  const projectFilter = projectId ? "AND p.id = ?" : "";
  const params = projectId ? [projectId] : [];
  await pool.query(
    `INSERT IGNORE INTO task_projects (task_id, project_id, active)
     SELECT t.id, p.id, t.active
     FROM tasks t
     CROSS JOIN projects p
     WHERE t.scope = 'global' ${projectFilter}`,
    params
  );
}

async function getReportableProjectOdsRows() {
  await ensureProjectsOdsColumn();
  const [rows] = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea') as research_line, p.ods_json
     FROM projects p
     WHERE ${reportableProjectCondition("p")}`
  );
  return Array.isArray(rows) ? (rows as any[]) : [];
}

app.get("/health", async (_req, res) => {
  try {
    await healthCheck();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "db_unavailable" });
  }
});

// Public applications (postulacion)
app.post("/applications", async (req, res) => {
  const { name, email, proposal, attachments = [] } = req.body || {};
  if (!email || !proposal) return res.status(400).json({ error: "email_and_proposal_required" });
  const id = uuid();
  try {
    await pool.query(
      "INSERT INTO applications (id, name, email, proposal, attachments_json, status) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name || null, email, proposal, JSON.stringify(attachments), "submitted"]
    );
    res.status(201).json({ id, status: "submitted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// Auth / registro (placeholder para Google OAuth)
app.post("/auth/register", async (req, res) => {
  const { name, email, projectTitle, projectDescription, inviteCode, career, cycle, campus, researchLine, ods, industry, responsibility } = req.body || {};
  if (!email || !name) return res.status(400).json({ error: "name_and_email_required" });
  const userId = uuid();
  const projectId = uuid();
  const code = inviteCode || generateInviteCode();
  const selectedOds = normalizeProjectOds(ods, researchLine);
  try {
    await ensureProjectsOdsColumn();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO users (id, role, email, name, career, cycle, campus) VALUES (?, 'student', ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           career = COALESCE(VALUES(career), career),
           cycle = COALESCE(VALUES(cycle), cycle),
           campus = COALESCE(VALUES(campus), campus)`,
        [userId, email, name, career || null, cycle || null, campus || null]
      );
      const [userRows] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
      const resolvedUserId =
        Array.isArray(userRows) && userRows.length > 0 ? (userRows[0] as any).id : userId;

      const [membershipRows] = await conn.query(`SELECT project_id FROM project_members WHERE user_id = ? LIMIT 1`, [resolvedUserId]);
      if (Array.isArray(membershipRows) && membershipRows.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: "already_registered" });
      }

      if (inviteCode) {
        const [rows] = await conn.query(`SELECT id, approval_status FROM projects WHERE invite_code = ? LIMIT 1`, [inviteCode]);
        if (!Array.isArray(rows) || rows.length === 0) {
          await conn.rollback();
          return res.status(404).json({ error: "project_code_not_found" });
        }
        const project = rows[0] as any;
        const [insertResult] = await conn.query(
          `INSERT IGNORE INTO project_members (project_id, user_id, role, responsibility) VALUES (?, ?, 'member', ?)`,
          [project.id, resolvedUserId, responsibility || null]
        );
        await conn.commit();
        const inserted = Boolean((insertResult as any)?.affectedRows);
        if (!inserted) {
          return res.status(409).json({ error: "already_registered" });
        }
        await notifyUsers(await getAdminUserIds(), {
          projectId: project.id,
          type: "project_join_request",
          message: `Nuevo miembro solicitó unirse al proyecto ${project.invite_code || project.id}.`,
        });
        return res
          .status(201)
          .json({ userId: resolvedUserId, projectId: project.id, inviteCode, approvalStatus: project.approval_status });
      }

      const [existingProjects] = await conn.query(`SELECT id FROM projects WHERE student_id = ? LIMIT 1`, [resolvedUserId]);
      if (Array.isArray(existingProjects) && existingProjects.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: "already_registered" });
      }

      await conn.query(
        `INSERT INTO projects (id, student_id, title, description, research_line, ods_json, industry, invite_code, approval_status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          projectId,
          resolvedUserId,
          projectTitle || "Proyecto innovador",
          projectDescription || "",
          researchLine || null,
          JSON.stringify(selectedOds),
          industry || null,
          code,
          resolvedUserId,
        ]
      );
      await conn.query(`INSERT INTO project_members (project_id, user_id, role, responsibility) VALUES (?, ?, 'owner', ?)`, [
        projectId,
        resolvedUserId,
        responsibility || null,
      ]);
      await conn.commit();
      await notifyUsers(await getAdminUserIds(), {
        projectId,
        type: "project_request",
        message: `Nuevo proyecto pendiente: ${projectTitle || "Proyecto innovador"}.`,
      });
      res.status(201).json({ userId: resolvedUserId, projectId, inviteCode: code, approvalStatus: "pending" });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email) return res.status(400).json({ error: "email_required" });
  try {
    const [rows] = await pool.query(
      `SELECT u.id as userId, u.role, u.name, u.password_hash, pm.project_id as projectId, p.invite_code, p.approval_status
       FROM users u
       LEFT JOIN project_members pm ON pm.user_id = u.id
       LEFT JOIN projects p ON p.id = pm.project_id
       WHERE u.email = ? LIMIT 1`,
      [email]
    );
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: "user_not_found" });
    const payload = rows[0] as any;
    if (payload.role === "admin") {
      if (!payload.password_hash) return res.status(401).json({ error: "password_required" });
      if (!password) return res.status(401).json({ error: "password_required" });
      const hash = crypto.createHash("sha256").update(String(password), "utf8").digest("hex");
      if (hash !== payload.password_hash) return res.status(401).json({ error: "invalid_password" });
    }
    if (payload.role !== "admin" && !payload.projectId) {
      return res.status(404).json({ error: "user_not_registered" });
    }
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// Phases & leaderboard
app.get("/phases", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, start_date, end_date FROM phases ORDER BY start_date");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/leaderboard", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.title, p.score, p.current_phase, p.invite_code, p.approval_status
       FROM projects p
       WHERE p.approval_status = 'approved'
       ORDER BY p.score DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// Projects
app.get("/projects/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, description, current_phase, score, invite_code, approval_status FROM projects WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/projects/:id/submissions", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, phase_id, url, comment, status, created_at, feedback
       FROM submissions WHERE project_id = ?
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/projects/:id/submissions", async (req, res) => {
  const { phaseId, url, comment } = req.body || {};
  if (!phaseId || !url) return res.status(400).json({ error: "phaseId_and_url_required" });
  try {
    const id = uuid();
    await pool.query(
      `INSERT INTO submissions (id, project_id, phase_id, url, comment, status) VALUES (?, ?, ?, ?, ?, 'sent')`,
      [id, req.params.id, phaseId, url, comment || null]
    );
    res.status(201).json({ id, status: "sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// Admin decision
app.post("/admin/projects/:id/decision", async (req, res) => {
  const { approved } = req.body || {};
  const status = approved ? "approved" : "rejected";
  try {
    await pool.query(`UPDATE projects SET approval_status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ id: req.params.id, approvalStatus: status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// Mensajeria
app.get("/projects/:id/messages", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, sender_id, body, created_at FROM messages WHERE project_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/projects/:id/messages", async (req, res) => {
  const { senderId, body } = req.body || {};
  if (!senderId || !body) return res.status(400).json({ error: "senderId_and_body_required" });
  try {
    const id = uuid();
    await pool.query(`INSERT INTO messages (id, project_id, sender_id, body) VALUES (?, ?, ?, ?)`, [
      id,
      req.params.id,
      senderId,
      body,
    ]);
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// Agenda (citas)
app.get("/projects/:id/appointments", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, slot_start, status, notes FROM appointments WHERE project_id = ? ORDER BY slot_start DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/projects/:id/appointments", async (req, res) => {
  const { slotStart, notes } = req.body || {};
  if (!slotStart) return res.status(400).json({ error: "slotStart_required" });
  try {
    const id = uuid();
    await pool.query(`INSERT INTO appointments (id, project_id, slot_start, status, notes) VALUES (?, ?, ?, 'requested', ?)`, [
      id,
      req.params.id,
      slotStart,
      notes || null,
    ]);
    res.status(201).json({ id, status: "requested" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// Reservas FabLab
app.post("/projects/:id/reservations", async (req, res) => {
  const { startAt, endAt, notes } = req.body || {};
  if (!startAt || !endAt) return res.status(400).json({ error: "startAt_and_endAt_required" });
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (end <= start) return res.status(400).json({ error: "end_must_be_after_start" });
  try {
    const [existing] = await pool.query(
      `SELECT id, start_at, end_at FROM reservations
       WHERE status IN ('requested','approved','blocked')`
    );
    const conflict =
      Array.isArray(existing) &&
      existing.find((r: any) => overlaps(start, end, new Date((r as any).start_at), new Date((r as any).end_at)));
    if (conflict) return res.status(409).json({ error: "time_slot_conflict", conflictId: (conflict as any).id });

    const id = uuid();
    await pool.query(
      `INSERT INTO reservations (id, project_id, start_at, end_at, status, notes) VALUES (?, ?, ?, ?, 'requested', ?)`,
      [id, req.params.id, start, end, notes || null]
    );
    await notifyUsers(await getAdminUserIds(), {
      projectId: req.params.id,
      type: "reservation_request",
      message: "Nueva solicitud de reserva FabLab.",
    });
    res.status(201).json({ id, status: "requested" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/reservations", async (req, res) => {
  const { status = "active" } = req.query as { status?: string };
  const statuses =
    status === "all"
      ? ["requested", "approved", "declined", "cancelled", "blocked"]
      : status === "active"
        ? ["requested", "approved", "blocked"]
        : [status];
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.project_id, r.start_at, r.end_at, r.status, r.notes, r.created_at, p.title
       FROM reservations r
       LEFT JOIN projects p ON p.id = r.project_id
       WHERE r.status IN (${statuses.map(() => "?").join(",")})
       ORDER BY r.start_at ASC`,
      statuses
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/reservations/:id/decision", async (req, res) => {
  const { approved, adminId } = req.body || {};
  const status = approved ? "approved" : "declined";
  try {
    await pool.query(`UPDATE reservations SET status = ?, approved_by = ? WHERE id = ?`, [status, adminId || null, req.params.id]);
    res.json({ id: req.params.id, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/admin/reservations/block", async (req, res) => {
  const { startAt, endAt, notes, adminId } = req.body || {};
  if (!startAt || !endAt) return res.status(400).json({ error: "startAt_and_endAt_required" });
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (end <= start) return res.status(400).json({ error: "end_must_be_after_start" });
  try {
    const [existing] = await pool.query(
      `SELECT id, start_at, end_at FROM reservations
       WHERE status IN ('requested','approved','blocked')`
    );
    const conflict =
      Array.isArray(existing) &&
      existing.find((r: any) => overlaps(start, end, new Date((r as any).start_at), new Date((r as any).end_at)));
    if (conflict) return res.status(409).json({ error: "time_slot_conflict", conflictId: (conflict as any).id });

    const id = uuid();
    await pool.query(
      `INSERT INTO reservations (id, project_id, start_at, end_at, status, notes, approved_by)
       VALUES (?, ?, ?, ?, 'blocked', ?, ?)`,
      [id, null, start, end, notes || null, adminId || null]
    );
    res.status(201).json({ id, status: "blocked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.delete("/admin/reservations/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT status FROM reservations WHERE id = ? LIMIT 1`, [req.params.id]);
    const status = Array.isArray(rows) && rows.length ? (rows[0] as any).status : null;
    if (!status) return res.status(404).json({ error: "not_found" });
    if (status !== "blocked") return res.status(400).json({ error: "only_blocked_can_be_deleted" });
    await pool.query(`DELETE FROM reservations WHERE id = ?`, [req.params.id]);
    res.json({ id: req.params.id, deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// Admin: metrics, projects, members
app.get("/admin/metrics", async (req, res) => {
  if (wantsHtml(req)) return sendAppShell(res);
  try {
    await ensureGlobalTaskAssignments();

    const [[users]] = (await pool.query("SELECT COUNT(*) as total FROM users")) as any;
    const [[students]] = (await pool.query(`SELECT COUNT(*) as total FROM users u WHERE u.role = 'student' AND ${validCareerCondition("u")}`)) as any;
    const [[projects]] = (await pool.query(`SELECT COUNT(*) as total FROM projects p WHERE ${reportableProjectCondition("p")}`)) as any;
    const [[pending]] = (await pool.query(
      `SELECT COUNT(*) as total FROM projects p WHERE p.approval_status = 'pending' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[reservations]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM reservations r
       JOIN projects p ON p.id = r.project_id
       WHERE r.status = 'requested' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[tasks]] = (await pool.query("SELECT COUNT(*) as total FROM tasks")) as any;
    const [[submissions]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM submissions s
       JOIN projects p ON p.id = s.project_id
       WHERE ${reportableProjectCondition("p")}`
    )) as any;
    const [studentsByCareer] = await pool.query(
      `SELECT TRIM(u.career) as career, COUNT(*) as total
       FROM users u
       WHERE u.role = 'student' AND ${validCareerCondition("u")}
       GROUP BY TRIM(u.career)
       ORDER BY total DESC`
    );
    const [studentsByCampus] = await pool.query(
      `SELECT TRIM(u.campus) as campus, COUNT(*) as total
       FROM users u
       WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${validCampusCondition("u")}
       GROUP BY TRIM(u.campus)
       ORDER BY total DESC`
    );
    const [projectsByCampus] = await pool.query(
      `SELECT TRIM(u.campus) as campus, COUNT(DISTINCT pm.project_id) as total
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       JOIN users u ON u.id = pm.user_id
       WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${validCampusCondition("u")} AND ${reportableProjectCondition("p")}
       GROUP BY TRIM(u.campus)
       ORDER BY total DESC`
    );
    const [researchLineByCareer] = await pool.query(
      `SELECT TRIM(u.career) as career, COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea') as research_line, COUNT(*) as total
       FROM projects p
       JOIN users u ON u.id = p.student_id
       WHERE ${validCareerCondition("u")} AND ${reportableProjectCondition("p")}
       GROUP BY TRIM(u.career), COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea')
       ORDER BY total DESC`
    );
    const [researchLineTotals] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea') as research_line, COUNT(*) as total
       FROM projects p
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea')
       ORDER BY total DESC`
    );
    const odsByResearchLine = buildOdsByResearchLineFromProjects(await getReportableProjectOdsRows());
    const [campusTaskStatus] = await pool.query(
      `SELECT pc.campus,
              COUNT(a.task_id) as total_active_tasks,
              SUM(CASE WHEN ls.status = 'reviewed' THEN 1 ELSE 0 END) as completed_active_tasks
       FROM (
         SELECT DISTINCT pm.project_id, COALESCE(u.campus, 'Sin sede') as campus
         FROM project_members pm
         JOIN projects p ON p.id = pm.project_id
         JOIN users u ON u.id = pm.user_id
         WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${validCampusCondition("u")} AND ${reportableProjectCondition("p")}
       ) pc
       LEFT JOIN (
         SELECT pc2.project_id, pc2.campus, tp.task_id
         FROM (
           SELECT DISTINCT pm.project_id, COALESCE(u.campus, 'Sin sede') as campus
           FROM project_members pm
           JOIN projects p ON p.id = pm.project_id
           JOIN users u ON u.id = pm.user_id
           WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${validCampusCondition("u")} AND ${reportableProjectCondition("p")}
         ) pc2
         JOIN task_projects tp ON tp.project_id = pc2.project_id AND tp.active = 1
         JOIN tasks t ON t.id = tp.task_id
       ) a ON a.project_id = pc.project_id AND a.campus = pc.campus
       LEFT JOIN (
         SELECT ts.task_id, ts.project_id, ts.status
         FROM task_submissions ts
         JOIN (
           SELECT task_id, project_id, MAX(created_at) as max_created
           FROM task_submissions
           GROUP BY task_id, project_id
         ) latest ON latest.task_id = ts.task_id AND latest.project_id = ts.project_id AND latest.max_created = ts.created_at
       ) ls ON ls.task_id = a.task_id AND ls.project_id = a.project_id
       GROUP BY pc.campus
       ORDER BY pc.campus ASC`
    );
    const formattedStudentsByCampus = formatCampusRows(studentsByCampus);
    const formattedProjectsByCampus = formatCampusRows(projectsByCampus);
    const formattedCampusTaskStatus = formatCampusRows(campusTaskStatus);

    res.json({
      users: users?.total || 0,
      students: students?.total || 0,
      projects: projects?.total || 0,
      pendingProjects: pending?.total || 0,
      pendingReservations: reservations?.total || 0,
      tasks: tasks?.total || 0,
      submissions: submissions?.total || 0,
      studentsByCareer,
      studentsByCampus: formattedStudentsByCampus,
      projectsByCampus: formattedProjectsByCampus,
      researchLineByCareer,
      researchLineTotals,
      odsByResearchLine,
      campusTaskStatus: formattedCampusTaskStatus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/admin/metrics-all", async (_req, res) => {
  try {
    const [[users]] = (await pool.query("SELECT COUNT(*) as total FROM users")) as any;
    const [[admins]] = (await pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'admin'")) as any;
    const [[students]] = (await pool.query(`SELECT COUNT(*) as total FROM users u WHERE u.role = 'student' AND ${validCareerCondition("u")}`)) as any;
    const [[projects]] = (await pool.query(`SELECT COUNT(*) as total FROM projects p WHERE ${reportableProjectCondition("p")}`)) as any;
    const [[projectsApproved]] = (await pool.query(
      `SELECT COUNT(*) as total FROM projects p WHERE p.approval_status = 'approved' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[projectsRejected]] = (await pool.query(
      `SELECT COUNT(*) as total FROM projects p WHERE p.approval_status = 'rejected' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[pending]] = (await pool.query(
      `SELECT COUNT(*) as total FROM projects p WHERE p.approval_status = 'pending' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[members]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       JOIN users u ON u.id = pm.user_id
       WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[reservations]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM reservations r
       JOIN projects p ON p.id = r.project_id
       WHERE ${reportableProjectCondition("p")}`
    )) as any;
    const [[reservationsPending]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM reservations r
       JOIN projects p ON p.id = r.project_id
       WHERE r.status = 'requested' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[tasks]] = (await pool.query("SELECT COUNT(*) as total FROM tasks")) as any;
    const [[taskSubmissions]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM task_submissions ts
       JOIN projects p ON p.id = ts.project_id
       WHERE ${reportableProjectCondition("p")}`
    )) as any;
    const [[phaseSubmissions]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM submissions s
       JOIN projects p ON p.id = s.project_id
       WHERE ${reportableProjectCondition("p")}`
    )) as any;
    const [[applications]] = (await pool.query("SELECT COUNT(*) as total FROM applications")) as any;
    const [studentsByCareer] = await pool.query(
      `SELECT TRIM(u.career) as career, COUNT(*) as total
       FROM users u
       WHERE u.role = 'student' AND ${validCareerCondition("u")}
       GROUP BY TRIM(u.career)
       ORDER BY total DESC`
    );
    const [studentsByCampus] = await pool.query(
      `SELECT TRIM(u.campus) as campus, COUNT(*) as total
       FROM users u
       WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${validCampusCondition("u")}
       GROUP BY TRIM(u.campus)
       ORDER BY total DESC`
    );
    const [projectsByCampus] = await pool.query(
      `SELECT TRIM(u.campus) as campus, COUNT(DISTINCT pm.project_id) as total
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       JOIN users u ON u.id = pm.user_id
       WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${validCampusCondition("u")} AND ${reportableProjectCondition("p")}
       GROUP BY TRIM(u.campus)
       ORDER BY total DESC`
    );
    const [researchLineByCareer] = await pool.query(
      `SELECT TRIM(u.career) as career, COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea') as research_line, COUNT(*) as total
       FROM projects p
       JOIN users u ON u.id = p.student_id
       WHERE ${validCareerCondition("u")} AND ${reportableProjectCondition("p")}
       GROUP BY TRIM(u.career), COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea')
       ORDER BY total DESC`
    );
    const [researchLineTotals] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea') as research_line, COUNT(*) as total
       FROM projects p
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea')
       ORDER BY total DESC`
    );
    const [projectsByStatus] = await pool.query(
      `SELECT COALESCE(p.approval_status, 'Sin estado') as status, COUNT(*) as total
       FROM projects p
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(p.approval_status, 'Sin estado')
       ORDER BY total DESC`
    );
    const [tasksByScope] = await pool.query(
      `SELECT COALESCE(scope, 'Sin alcance') as scope, COUNT(*) as total
       FROM tasks
       GROUP BY COALESCE(scope, 'Sin alcance')
       ORDER BY total DESC`
    );
    const [taskSubmissionsByStatus] = await pool.query(
      `SELECT COALESCE(ts.status, 'Sin estado') as status, COUNT(*) as total
       FROM task_submissions ts
       JOIN projects p ON p.id = ts.project_id
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(ts.status, 'Sin estado')
       ORDER BY total DESC`
    );
    const [phaseSubmissionsByStatus] = await pool.query(
      `SELECT COALESCE(s.status, 'Sin estado') as status, COUNT(*) as total
       FROM submissions s
       JOIN projects p ON p.id = s.project_id
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(s.status, 'Sin estado')
       ORDER BY total DESC`
    );
    const [reservationsByStatus] = await pool.query(
      `SELECT COALESCE(r.status, 'Sin estado') as status, COUNT(*) as total
       FROM reservations r
       JOIN projects p ON p.id = r.project_id
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(r.status, 'Sin estado')
       ORDER BY total DESC`
    );
    const [applicationsByStatus] = await pool.query(
      `SELECT COALESCE(status, 'Sin estado') as status, COUNT(*) as total
       FROM applications
       GROUP BY COALESCE(status, 'Sin estado')
       ORDER BY total DESC`
    );
    const odsByResearchLine = buildOdsByResearchLineFromProjects(await getReportableProjectOdsRows());

    const formattedStudentsByCampus = formatCampusRows(studentsByCampus);
    const formattedProjectsByCampus = formatCampusRows(projectsByCampus);

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        users: users?.total || 0,
        admins: admins?.total || 0,
        students: students?.total || 0,
        projects: projects?.total || 0,
        projectsApproved: projectsApproved?.total || 0,
        projectsPending: pending?.total || 0,
        projectsRejected: projectsRejected?.total || 0,
        members: members?.total || 0,
        tasks: tasks?.total || 0,
        taskSubmissions: taskSubmissions?.total || 0,
        phaseSubmissions: phaseSubmissions?.total || 0,
        reservations: reservations?.total || 0,
        reservationsPending: reservationsPending?.total || 0,
        applications: applications?.total || 0,
      },
      studentsByCareer,
      studentsByCampus: formattedStudentsByCampus,
      projectsByCampus: formattedProjectsByCampus,
      researchLineByCareer,
      researchLineTotals,
      odsByResearchLine,
      projectsByStatus,
      tasksByScope,
      taskSubmissionsByStatus,
      phaseSubmissionsByStatus,
      reservationsByStatus,
      applicationsByStatus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatCampusLabel(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "Sin sede";
  const lowered = raw.toLowerCase();
  if (lowered === "sin sede") return "Sin sede";
  return lowered
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function formatCampusRows(rows: any) {
  if (!Array.isArray(rows)) return rows;
  return rows.filter((row) => hasCampusValue(row.campus)).map((row) => ({ ...row, campus: formatCampusLabel(row.campus) }));
}

app.get("/admin/metrics.csv", async (_req, res) => {
  try {
    const [[users]] = (await pool.query("SELECT COUNT(*) as total FROM users")) as any;
    const [[students]] = (await pool.query(`SELECT COUNT(*) as total FROM users u WHERE u.role = 'student' AND ${validCareerCondition("u")}`)) as any;
    const [[projects]] = (await pool.query(`SELECT COUNT(*) as total FROM projects p WHERE ${reportableProjectCondition("p")}`)) as any;
    const [[pending]] = (await pool.query(
      `SELECT COUNT(*) as total FROM projects p WHERE p.approval_status = 'pending' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[reservations]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM reservations r
       JOIN projects p ON p.id = r.project_id
       WHERE r.status = 'requested' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[tasks]] = (await pool.query("SELECT COUNT(*) as total FROM tasks")) as any;
    const [[submissions]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM submissions s
       JOIN projects p ON p.id = s.project_id
       WHERE ${reportableProjectCondition("p")}`
    )) as any;
    const [studentsByCareer] = await pool.query(
      `SELECT TRIM(u.career) as career, COUNT(*) as total
       FROM users u
       WHERE u.role = 'student' AND ${validCareerCondition("u")}
       GROUP BY TRIM(u.career)
       ORDER BY total DESC`
    );
    const [studentsByCampus] = await pool.query(
      `SELECT TRIM(u.campus) as campus, COUNT(*) as total
       FROM users u
       WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${validCampusCondition("u")}
       GROUP BY TRIM(u.campus)
       ORDER BY total DESC`
    );
    const [projectsByCampus] = await pool.query(
      `SELECT TRIM(u.campus) as campus, COUNT(DISTINCT pm.project_id) as total
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       JOIN users u ON u.id = pm.user_id
       WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${validCampusCondition("u")} AND ${reportableProjectCondition("p")}
       GROUP BY TRIM(u.campus)
       ORDER BY total DESC`
    );
    const [researchLineTotals] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea') as research_line, COUNT(*) as total
       FROM projects p
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea')
       ORDER BY total DESC`
    );
    const odsByResearchLine = buildOdsByResearchLineFromProjects(await getReportableProjectOdsRows());

    const rows: string[] = [];
    rows.push(["section", "label", "value"].map(csvEscape).join(","));
    rows.push(["summary", "users", users?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "students", students?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "projects", projects?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "pendingProjects", pending?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "pendingReservations", reservations?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "tasks", tasks?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "submissions", submissions?.total || 0].map(csvEscape).join(","));

    if (Array.isArray(studentsByCareer)) {
      for (const row of studentsByCareer as any[]) {
        rows.push(["students_by_career", row.career, row.total].map(csvEscape).join(","));
      }
    }
    const csvStudentsByCampus = formatCampusRows(studentsByCampus);
    if (Array.isArray(csvStudentsByCampus)) {
      for (const row of csvStudentsByCampus as any[]) {
        rows.push(["students_by_campus", formatCampusLabel(row.campus), row.total].map(csvEscape).join(","));
      }
    }
    const csvProjectsByCampus = formatCampusRows(projectsByCampus);
    if (Array.isArray(csvProjectsByCampus)) {
      for (const row of csvProjectsByCampus as any[]) {
        rows.push(["projects_by_campus", formatCampusLabel(row.campus), row.total].map(csvEscape).join(","));
      }
    }
    if (Array.isArray(researchLineTotals)) {
      for (const row of researchLineTotals as any[]) {
        rows.push(["research_line_totals", formatResearchLine(row.research_line), row.total].map(csvEscape).join(","));
      }
    }
    if (Array.isArray(odsByResearchLine)) {
      for (const row of odsByResearchLine as any[]) {
        rows.push(["ods_by_research_line", `${row.ods} - ${row.research_line}`, row.total].map(csvEscape).join(","));
      }
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=metrics.csv");
    res.send(rows.join("\n"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/admin/metrics-all.csv", async (_req, res) => {
  try {
    const [[users]] = (await pool.query("SELECT COUNT(*) as total FROM users")) as any;
    const [[admins]] = (await pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'admin'")) as any;
    const [[students]] = (await pool.query(`SELECT COUNT(*) as total FROM users u WHERE u.role = 'student' AND ${validCareerCondition("u")}`)) as any;
    const [[projects]] = (await pool.query(`SELECT COUNT(*) as total FROM projects p WHERE ${reportableProjectCondition("p")}`)) as any;
    const [[projectsApproved]] = (await pool.query(
      `SELECT COUNT(*) as total FROM projects p WHERE p.approval_status = 'approved' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[projectsRejected]] = (await pool.query(
      `SELECT COUNT(*) as total FROM projects p WHERE p.approval_status = 'rejected' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[pending]] = (await pool.query(
      `SELECT COUNT(*) as total FROM projects p WHERE p.approval_status = 'pending' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[members]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       JOIN users u ON u.id = pm.user_id
       WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[reservations]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM reservations r
       JOIN projects p ON p.id = r.project_id
       WHERE ${reportableProjectCondition("p")}`
    )) as any;
    const [[reservationsPending]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM reservations r
       JOIN projects p ON p.id = r.project_id
       WHERE r.status = 'requested' AND ${reportableProjectCondition("p")}`
    )) as any;
    const [[tasks]] = (await pool.query("SELECT COUNT(*) as total FROM tasks")) as any;
    const [[taskSubmissions]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM task_submissions ts
       JOIN projects p ON p.id = ts.project_id
       WHERE ${reportableProjectCondition("p")}`
    )) as any;
    const [[phaseSubmissions]] = (await pool.query(
      `SELECT COUNT(*) as total
       FROM submissions s
       JOIN projects p ON p.id = s.project_id
       WHERE ${reportableProjectCondition("p")}`
    )) as any;
    const [[applications]] = (await pool.query("SELECT COUNT(*) as total FROM applications")) as any;
    const [studentsByCareer] = await pool.query(
      `SELECT TRIM(u.career) as career, COUNT(*) as total
       FROM users u
       WHERE u.role = 'student' AND ${validCareerCondition("u")}
       GROUP BY TRIM(u.career)
       ORDER BY total DESC`
    );
    const [studentsByCampus] = await pool.query(
      `SELECT TRIM(u.campus) as campus, COUNT(*) as total
       FROM users u
       WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${validCampusCondition("u")}
       GROUP BY TRIM(u.campus)
       ORDER BY total DESC`
    );
    const [projectsByCampus] = await pool.query(
      `SELECT TRIM(u.campus) as campus, COUNT(DISTINCT pm.project_id) as total
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       JOIN users u ON u.id = pm.user_id
       WHERE u.role = 'student' AND ${validCareerCondition("u")} AND ${validCampusCondition("u")} AND ${reportableProjectCondition("p")}
       GROUP BY TRIM(u.campus)
       ORDER BY total DESC`
    );
    const [researchLineTotals] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea') as research_line, COUNT(*) as total
       FROM projects p
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(NULLIF(TRIM(p.research_line), ''), 'Sin línea')
       ORDER BY total DESC`
    );
    const [projectsByStatus] = await pool.query(
      `SELECT COALESCE(p.approval_status, 'Sin estado') as status, COUNT(*) as total
       FROM projects p
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(p.approval_status, 'Sin estado')
       ORDER BY total DESC`
    );
    const [tasksByScope] = await pool.query(
      `SELECT COALESCE(scope, 'Sin alcance') as scope, COUNT(*) as total
       FROM tasks
       GROUP BY COALESCE(scope, 'Sin alcance')
       ORDER BY total DESC`
    );
    const [taskSubmissionsByStatus] = await pool.query(
      `SELECT COALESCE(ts.status, 'Sin estado') as status, COUNT(*) as total
       FROM task_submissions ts
       JOIN projects p ON p.id = ts.project_id
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(ts.status, 'Sin estado')
       ORDER BY total DESC`
    );
    const [phaseSubmissionsByStatus] = await pool.query(
      `SELECT COALESCE(s.status, 'Sin estado') as status, COUNT(*) as total
       FROM submissions s
       JOIN projects p ON p.id = s.project_id
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(s.status, 'Sin estado')
       ORDER BY total DESC`
    );
    const [reservationsByStatus] = await pool.query(
      `SELECT COALESCE(r.status, 'Sin estado') as status, COUNT(*) as total
       FROM reservations r
       JOIN projects p ON p.id = r.project_id
       WHERE ${reportableProjectCondition("p")}
       GROUP BY COALESCE(r.status, 'Sin estado')
       ORDER BY total DESC`
    );
    const [applicationsByStatus] = await pool.query(
      `SELECT COALESCE(status, 'Sin estado') as status, COUNT(*) as total
       FROM applications
       GROUP BY COALESCE(status, 'Sin estado')
       ORDER BY total DESC`
    );
    const odsByResearchLine = buildOdsByResearchLineFromProjects(await getReportableProjectOdsRows());

    const rows: string[] = [];
    rows.push(["section", "label", "value"].map(csvEscape).join(","));
    rows.push(["summary", "users", users?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "admins", admins?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "students", students?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "projects", projects?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "projectsApproved", projectsApproved?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "pendingProjects", pending?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "projectsRejected", projectsRejected?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "members", members?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "reservations", reservations?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "pendingReservations", reservationsPending?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "tasks", tasks?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "taskSubmissions", taskSubmissions?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "phaseSubmissions", phaseSubmissions?.total || 0].map(csvEscape).join(","));
    rows.push(["summary", "applications", applications?.total || 0].map(csvEscape).join(","));

    if (Array.isArray(studentsByCareer)) {
      for (const row of studentsByCareer as any[]) {
        rows.push(["students_by_career", row.career, row.total].map(csvEscape).join(","));
      }
    }
    const csvStudentsByCampus = formatCampusRows(studentsByCampus);
    if (Array.isArray(csvStudentsByCampus)) {
      for (const row of csvStudentsByCampus as any[]) {
        rows.push(["students_by_campus", formatCampusLabel(row.campus), row.total].map(csvEscape).join(","));
      }
    }
    const csvProjectsByCampus = formatCampusRows(projectsByCampus);
    if (Array.isArray(csvProjectsByCampus)) {
      for (const row of csvProjectsByCampus as any[]) {
        rows.push(["projects_by_campus", formatCampusLabel(row.campus), row.total].map(csvEscape).join(","));
      }
    }
    if (Array.isArray(researchLineTotals)) {
      for (const row of researchLineTotals as any[]) {
        rows.push(["research_line_totals", formatResearchLine(row.research_line), row.total].map(csvEscape).join(","));
      }
    }
    if (Array.isArray(odsByResearchLine)) {
      for (const row of odsByResearchLine as any[]) {
        rows.push(["ods_by_research_line", `${row.ods} - ${row.research_line}`, row.total].map(csvEscape).join(","));
      }
    }
    if (Array.isArray(projectsByStatus)) {
      for (const row of projectsByStatus as any[]) {
        rows.push(["projects_by_status", row.status, row.total].map(csvEscape).join(","));
      }
    }
    if (Array.isArray(tasksByScope)) {
      for (const row of tasksByScope as any[]) {
        rows.push(["tasks_by_scope", row.scope, row.total].map(csvEscape).join(","));
      }
    }
    if (Array.isArray(taskSubmissionsByStatus)) {
      for (const row of taskSubmissionsByStatus as any[]) {
        rows.push(["task_submissions_by_status", row.status, row.total].map(csvEscape).join(","));
      }
    }
    if (Array.isArray(phaseSubmissionsByStatus)) {
      for (const row of phaseSubmissionsByStatus as any[]) {
        rows.push(["phase_submissions_by_status", row.status, row.total].map(csvEscape).join(","));
      }
    }
    if (Array.isArray(reservationsByStatus)) {
      for (const row of reservationsByStatus as any[]) {
        rows.push(["reservations_by_status", row.status, row.total].map(csvEscape).join(","));
      }
    }
    if (Array.isArray(applicationsByStatus)) {
      for (const row of applicationsByStatus as any[]) {
        rows.push(["applications_by_status", row.status, row.total].map(csvEscape).join(","));
      }
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=metrics-all.csv");
    res.send(rows.join("\n"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/admin/projects", async (req, res) => {
  const { status, reportable } = req.query as { status?: string; reportable?: string };
  const filters: string[] = [];
  const params: string[] = [];
  if (status) {
    filters.push("p.approval_status = ?");
    params.push(status);
  }
  if (String(reportable || "") === "1") {
    filters.push(reportableProjectCondition("p"));
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.title, p.description, p.invite_code, p.approval_status, p.created_at,
              COUNT(pm.user_id) as member_count
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       ${where}
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

async function deleteProjectCascade(conn: any, projectId: string) {
  await conn.query("DELETE FROM notifications WHERE project_id = ?", [projectId]);
  await conn.query("DELETE FROM task_submissions WHERE project_id = ?", [projectId]);
  await conn.query("DELETE FROM task_projects WHERE project_id = ?", [projectId]);
  await conn.query("DELETE FROM reservations WHERE project_id = ?", [projectId]);
  await conn.query("DELETE FROM appointments WHERE project_id = ?", [projectId]);
  await conn.query("DELETE FROM messages WHERE project_id = ?", [projectId]);
  await conn.query("DELETE FROM submissions WHERE project_id = ?", [projectId]);
  await conn.query("DELETE FROM scores WHERE project_id = ?", [projectId]);
  await conn.query("DELETE FROM project_members WHERE project_id = ?", [projectId]);
  await conn.query("DELETE FROM projects WHERE id = ?", [projectId]);
}

app.patch("/admin/projects/:id", async (req, res) => {
  const { title, description } = req.body || {};
  try {
    await pool.query(`UPDATE projects SET title = COALESCE(?, title), description = COALESCE(?, description) WHERE id = ?`, [
      title || null,
      description || null,
      req.params.id,
    ]);
    res.json({ id: req.params.id, ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.delete("/admin/projects/:id", async (req, res) => {
  const projectId = req.params.id;
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await deleteProjectCascade(conn, projectId);
      await conn.commit();
      res.json({ id: projectId, deleted: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/admin/users", async (req, res) => {
  if (wantsHtml(req)) return sendAppShell(res);
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.created_at,
              COUNT(DISTINCT pm.project_id) as project_count
       FROM users u
       LEFT JOIN project_members pm ON pm.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.delete("/admin/users/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [owned] = await conn.query(`SELECT id FROM projects WHERE student_id = ?`, [userId]);
      if (Array.isArray(owned)) {
        for (const row of owned as any[]) {
          await deleteProjectCascade(conn, row.id);
        }
      }
      await conn.query("DELETE FROM task_submissions WHERE submitted_by = ?", [userId]);
      const [taskRows] = await conn.query("SELECT id FROM tasks WHERE created_by = ?", [userId]);
      if (Array.isArray(taskRows)) {
        for (const row of taskRows as any[]) {
          await conn.query("DELETE FROM task_submissions WHERE task_id = ?", [row.id]);
          await conn.query("DELETE FROM task_projects WHERE task_id = ?", [row.id]);
        }
      }
      await conn.query("DELETE FROM tasks WHERE created_by = ?", [userId]);
      await conn.query("DELETE FROM notifications WHERE user_id = ?", [userId]);
      await conn.query("DELETE FROM messages WHERE sender_id = ?", [userId]);
      await conn.query("DELETE FROM project_members WHERE user_id = ?", [userId]);
      await conn.query("UPDATE reservations SET approved_by = NULL WHERE approved_by = ?", [userId]);
      await conn.query("UPDATE projects SET created_by = NULL WHERE created_by = ?", [userId]);
      await conn.query("DELETE FROM users WHERE id = ?", [userId]);
      await conn.commit();
      res.json({ id: userId, deleted: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/admin/projects/:id/members", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.name, u.career, u.campus, u.cycle, pm.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY pm.added_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/admin/projects/:id/tasks", async (req, res) => {
  const projectId = req.params.id;
  const includeInactive = String(req.query.includeInactive || "") === "1";
  try {
    await ensureGlobalTaskAssignments(projectId);
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.description, t.due_at, t.scope, t.category, t.task_group, t.points, t.icon_key, t.active,
              tp.active as assignment_active, t.created_at,
              s.id as submission_id, s.status as submission_status, s.feedback as submission_feedback, s.points as submission_points, s.created_at as submission_created_at, s.url as submission_url, s.comment as submission_comment,
              s.submitted_by as submission_submitted_by, u.name as submission_submitter_name, u.email as submission_submitter_email
       FROM tasks t
       LEFT JOIN task_projects tp ON tp.task_id = t.id AND tp.project_id = ?
       LEFT JOIN task_submissions s ON s.task_id = t.id
        AND s.project_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM task_submissions newer
          WHERE newer.task_id = s.task_id
            AND newer.project_id = s.project_id
            AND (
              newer.created_at > s.created_at
              OR (newer.created_at = s.created_at AND newer.id > s.id)
            )
        )
       LEFT JOIN users u ON u.id = s.submitted_by
       WHERE tp.project_id = ? ${includeInactive ? "" : "AND tp.active = 1"}
       ORDER BY t.created_at DESC`,
      [projectId, projectId, projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/admin/projects/:id/task-assignments", async (req, res) => {
  const projectId = req.params.id;
  try {
    await ensureGlobalTaskAssignments(projectId);
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.description, t.due_at, t.scope, t.category, t.task_group, t.points, t.icon_key, t.created_at,
              CASE WHEN tp.project_id IS NULL THEN 0 ELSE 1 END as assigned,
              COALESCE(tp.active, 0) as assignment_active
       FROM tasks t
       LEFT JOIN task_projects tp ON tp.task_id = t.id AND tp.project_id = ?
       WHERE t.scope IN ('global', 'project')
       ORDER BY t.created_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.patch("/admin/projects/:id/tasks/:taskId/active", async (req, res) => {
  const { active } = req.body || {};
  const resolved = active ? 1 : 0;
  const projectId = req.params.id;
  const taskId = req.params.taskId;
  try {
    await ensureGlobalTaskAssignments(projectId);
    const [projects] = await pool.query("SELECT id FROM projects WHERE id = ? LIMIT 1", [projectId]);
    if (!Array.isArray(projects) || projects.length === 0) return res.status(404).json({ error: "project_not_found" });

    const [tasks] = await pool.query("SELECT id, scope FROM tasks WHERE id = ? LIMIT 1", [taskId]);
    if (!Array.isArray(tasks) || tasks.length === 0) return res.status(404).json({ error: "task_not_found" });

    if (resolved) {
      await pool.query(
        `INSERT INTO task_projects (task_id, project_id, active)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE active = VALUES(active)`,
        [taskId, projectId]
      );
    } else {
      await pool.query("UPDATE task_projects SET active = 0 WHERE task_id = ? AND project_id = ?", [taskId, projectId]);
    }

    res.json({ projectId, taskId, active: Boolean(resolved) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/admin/projects/:id/members", async (req, res) => {
  const { email, name, role = "member" } = req.body || {};
  if (!email) return res.status(400).json({ error: "email_required" });
  try {
    const [rows] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    const userId = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any).id : uuid();
    if (!Array.isArray(rows) || rows.length === 0) {
      await pool.query(`INSERT INTO users (id, role, email, name) VALUES (?, 'student', ?, ?)`, [userId, email, name || null]);
    }
    await pool.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [req.params.id, userId, role]
    );
    res.status(201).json({ projectId: req.params.id, userId, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.delete("/admin/projects/:id/members/:userId", async (req, res) => {
  try {
    await pool.query(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, [req.params.id, req.params.userId]);
    res.json({ projectId: req.params.id, userId: req.params.userId, deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/admin/projects/:id/move-member", async (req, res) => {
  const { userId, targetProjectId, role = "member" } = req.body || {};
  if (!userId || !targetProjectId) return res.status(400).json({ error: "userId_and_targetProjectId_required" });
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, [req.params.id, userId]);
      await conn.query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE role = VALUES(role)`,
        [targetProjectId, userId, role]
      );
      await conn.commit();
      res.json({ fromProjectId: req.params.id, toProjectId: targetProjectId, userId, role });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/admin/reservations", async (req, res) => {
  const { status = "requested" } = req.query as { status?: string };
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.project_id, r.start_at, r.end_at, r.status, r.notes, r.created_at, p.title
       FROM reservations r
       JOIN projects p ON p.id = r.project_id
       WHERE r.status = ?
       ORDER BY r.created_at DESC`,
      [status]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// Tasks
app.post("/admin/tasks", async (req, res) => {
  const { title, description, dueAt, scope, projectIds = [], adminId, iconKey, points, active, category, taskGroup } = req.body || {};
  const selectedProjectIds = Array.isArray(projectIds)
    ? Array.from(new Set(projectIds.map((pid: unknown) => String(pid || "").trim()).filter(Boolean)))
    : [];
  if (!title || !scope) return res.status(400).json({ error: "title_and_scope_required" });
  if (scope !== "global" && scope !== "project") return res.status(400).json({ error: "invalid_scope" });
  if (!Number.isFinite(Number(points))) return res.status(400).json({ error: "points_required" });
  if (scope === "project" && selectedProjectIds.length === 0) {
    return res.status(400).json({ error: "projectIds_required" });
  }
  try {
    const taskId = uuid();
    await pool.query(
      `INSERT INTO tasks (id, title, description, due_at, scope, category, task_group, active, points, icon_key, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        title,
        description || null,
        dueAt || null,
        scope,
        category || null,
        taskGroup || null,
        active ? 1 : 0,
        Number(points) || 0,
        iconKey || null,
        adminId || null,
      ]
    );
    if (scope === "project") {
      const rows = selectedProjectIds.map(() => "(?, ?, ?)").join(",");
      const params = selectedProjectIds.flatMap((pid: string) => [taskId, pid, active ? 1 : 0]);
      await pool.query(`INSERT INTO task_projects (task_id, project_id, active) VALUES ${rows}`, params);
    } else {
      await ensureGlobalTaskAssignments();
    }
    res.status(201).json({ id: taskId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/admin/tasks", async (req, res) => {
  if (wantsHtml(req)) return sendAppShell(res);
  try {
    const [rows] = await pool.query(
      `SELECT id, title, description, due_at, scope, category, task_group, active, points, icon_key, created_at
       FROM tasks ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.patch("/admin/tasks/:id/active", async (req, res) => {
  const { active } = req.body || {};
  const resolved = active ? 1 : 0;
  try {
    const [tasks] = await pool.query("SELECT scope FROM tasks WHERE id = ? LIMIT 1", [req.params.id]);
    if (!Array.isArray(tasks) || tasks.length === 0) return res.status(404).json({ error: "task_not_found" });
    if ((tasks[0] as any).scope !== "global") return res.status(400).json({ error: "only_global_tasks_can_use_global_active" });

    await pool.query(`UPDATE tasks SET active = ? WHERE id = ?`, [resolved, req.params.id]);
    await ensureGlobalTaskAssignments();
    await pool.query("UPDATE task_projects SET active = ? WHERE task_id = ?", [resolved, req.params.id]);
    res.json({ id: req.params.id, active: Boolean(resolved) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/admin/tasks/:id/submissions", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ts.id, ts.project_id, ts.submitted_by, ts.url, ts.comment, ts.status, ts.feedback, ts.points, ts.created_at,
              u.name as submitter_name, u.email as submitter_email, p.title as project_title
       FROM task_submissions ts
       JOIN users u ON u.id = ts.submitted_by
       JOIN projects p ON p.id = ts.project_id
       WHERE ts.task_id = ?
       ORDER BY ts.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/admin/tasks/:id/feedback", async (req, res) => {
  const taskId = req.params.id;
  const { submissionId, feedback, projectId: requestedProjectId } = req.body || {};
  if (!submissionId) return res.status(400).json({ error: "submissionId_required" });
  const projectFilter = requestedProjectId ? "AND ts.project_id = ?" : "";
  const submissionParams = requestedProjectId ? [submissionId, taskId, requestedProjectId] : [submissionId, taskId];
  try {
    const conn = await pool.getConnection();
    let projectId: string | null = null;
    let delta = 0;
    let resolvedPoints = 0;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT ts.project_id, ts.points, t.points as task_points
         FROM task_submissions ts
         JOIN tasks t ON t.id = ts.task_id
         WHERE ts.id = ? AND ts.task_id = ? ${projectFilter}
         LIMIT 1`,
        submissionParams
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "not_found" });
      }
      projectId = (rows[0] as any).project_id;
      const prevPoints = Number((rows[0] as any).points || 0);
      resolvedPoints = Number((rows[0] as any).task_points || 0);
      delta = resolvedPoints - prevPoints;
      await conn.query(
        `UPDATE task_submissions SET status = 'reviewed', feedback = ?, points = ? WHERE id = ? AND task_id = ?`,
        [feedback || null, resolvedPoints, submissionId, taskId]
      );
      if (projectId && delta !== 0) {
        await conn.query(`UPDATE projects SET score = GREATEST(0, score + ?) WHERE id = ?`, [delta, projectId]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    if (projectId) {
      const [members] = await pool.query(`SELECT user_id FROM project_members WHERE project_id = ?`, [projectId]);
      const memberIds = Array.isArray(members) ? members.map((m: any) => m.user_id) : [];
      await notifyUsers(memberIds, { projectId, type: "task_feedback", message: "El administrador aceptó una tarea." });
    }
    res.json({ id: submissionId, status: "reviewed", points: resolvedPoints, delta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/admin/tasks/:id/submissions/:submissionId/reject", async (req, res) => {
  const { submissionId, id } = req.params;
  const { projectId } = req.body || {};
  const projectFilter = projectId ? "AND project_id = ?" : "";
  const submissionParams = projectId ? [submissionId, id, projectId] : [submissionId, id];
  try {
    const conn = await pool.getConnection();
    let rejectedProjectId: string | null = null;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT project_id, points
         FROM task_submissions
         WHERE id = ? AND task_id = ? ${projectFilter}
         LIMIT 1`,
        submissionParams
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "not_found" });
      }
      const row = rows[0] as any;
      rejectedProjectId = row.project_id || null;
      const points = Number(row.points || 0);
      await conn.query(`DELETE FROM task_submissions WHERE id = ? AND task_id = ? ${projectFilter}`, submissionParams);
      if (row.project_id && points > 0) {
        await conn.query(`UPDATE projects SET score = GREATEST(0, score - ?) WHERE id = ?`, [points, row.project_id]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    if (rejectedProjectId) {
      const [members] = await pool.query(`SELECT user_id FROM project_members WHERE project_id = ?`, [rejectedProjectId]);
      const memberIds = Array.isArray(members) ? members.map((m: any) => m.user_id) : [];
      await notifyUsers(memberIds, { projectId: rejectedProjectId, type: "task_rejected", message: "El administrador rechazó una tarea. Puedes reenviarla." });
    }
    res.json({ id: submissionId, deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.delete("/admin/tasks/:id", async (req, res) => {
  const taskId = req.params.id;
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM task_submissions WHERE task_id = ?", [taskId]);
      await conn.query("DELETE FROM task_projects WHERE task_id = ?", [taskId]);
      const [result] = await conn.query("DELETE FROM tasks WHERE id = ?", [taskId]);
      await conn.commit();
      const deleted = Boolean((result as any)?.affectedRows);
      res.json({ id: taskId, deleted });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/projects/:id/tasks", async (req, res) => {
  const projectId = req.params.id;
  try {
    await ensureGlobalTaskAssignments(projectId);
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.description, t.due_at, t.scope, t.category, t.task_group, t.points, t.icon_key, t.created_at,
              s.id as submission_id, s.status as submission_status, s.feedback as submission_feedback, s.points as submission_points, s.created_at as submission_created_at, s.url as submission_url, s.comment as submission_comment,
              s.submitted_by as submission_submitted_by, u.name as submission_submitter_name, u.email as submission_submitter_email
       FROM tasks t
       LEFT JOIN task_projects tp ON tp.task_id = t.id AND tp.project_id = ?
       LEFT JOIN task_submissions s ON s.task_id = t.id
        AND s.project_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM task_submissions newer
          WHERE newer.task_id = s.task_id
            AND newer.project_id = s.project_id
            AND (
              newer.created_at > s.created_at
              OR (newer.created_at = s.created_at AND newer.id > s.id)
            )
        )
       LEFT JOIN users u ON u.id = s.submitted_by
       WHERE tp.project_id IS NOT NULL AND tp.active = 1
       ORDER BY t.created_at DESC`,
      [projectId, projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/projects/:id/tasks/:taskId/submissions", async (req, res) => {
  const { submittedBy, url, comment } = req.body || {};
  if (!submittedBy) return res.status(400).json({ error: "submittedBy_required" });
  try {
    const id = uuid();
    await pool.query(
      `INSERT INTO task_submissions (id, task_id, project_id, submitted_by, url, comment, status)
       VALUES (?, ?, ?, ?, ?, ?, 'submitted')`,
      [id, req.params.taskId, req.params.id, submittedBy, url || null, comment || null]
    );
    await notifyUsers(await getAdminUserIds(), {
      projectId: req.params.id,
      type: "task_submitted",
      message: "Nuevo envío de tarea por un grupo.",
    });
    res.status(201).json({ id, status: "submitted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// SciManage papers
app.get("/api/scimanage/papers", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, titulo, integrantes, sede, ods_json, linea_investigacion, pais_revista, status, link_revista, pago_status, pago_drive_url, pago_monto_pen, created_at, updated_at
       FROM scimanage_papers
       ORDER BY created_at DESC`
    );
    const mapped = Array.isArray(rows) ? rows.map((row: any) => mapScimanagePaper(row)) : [];
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/api/scimanage/papers", async (req, res) => {
  const payload = req.body || {};
  if (!payload.titulo || !payload.sede || !payload.lineaInvestigacion || !payload.paisRevista) {
    return res.status(400).json({ error: "missing_required_fields" });
  }
  const pagoStatus = payload.pagoStatus === "pagado" ? "pagado" : "pendiente";
  const rawPagoMontoPen = Number(payload.pagoMontoPen || 0);
  const pagoMontoPen = pagoStatus === "pagado" && Number.isFinite(rawPagoMontoPen) ? Math.max(0, rawPagoMontoPen) : 0;
  const id = String(payload.id || `pp-${uuid()}`);
  const now = new Date().toISOString();
  const createdAt = toMysqlDateTime(payload.createdAt || now);
  const updatedAt = toMysqlDateTime(payload.updatedAt || now);
  try {
    await pool.query(
      `INSERT INTO scimanage_papers (
        id, titulo, integrantes, sede, ods_json, linea_investigacion, pais_revista, status,
        link_revista, pago_status, pago_drive_url, pago_monto_pen, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        String(payload.titulo).trim(),
        Math.max(1, Number(payload.integrantes || 1)),
        String(payload.sede).trim(),
        JSON.stringify(Array.isArray(payload.ods) ? payload.ods : []),
        String(payload.lineaInvestigacion).trim(),
        String(payload.paisRevista).trim(),
        payload.status === "finalizado" ? "finalizado" : "en_proceso",
        String(payload.linkRevista || "").trim(),
        pagoStatus,
        String(payload.pagoDriveUrl || "").trim(),
        pagoMontoPen,
        createdAt,
        updatedAt,
      ]
    );
    const [rows] = await pool.query("SELECT * FROM scimanage_papers WHERE id = ? LIMIT 1", [id]);
    const row = Array.isArray(rows) && rows.length > 0 ? mapScimanagePaper(rows[0]) : null;
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.put("/api/scimanage/papers/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const payload = req.body || {};
  if (!id) return res.status(400).json({ error: "id_required" });
  if (!payload.titulo || !payload.sede || !payload.lineaInvestigacion || !payload.paisRevista) {
    return res.status(400).json({ error: "missing_required_fields" });
  }
  const pagoStatus = payload.pagoStatus === "pagado" ? "pagado" : "pendiente";
  const rawPagoMontoPen = Number(payload.pagoMontoPen || 0);
  const pagoMontoPen = pagoStatus === "pagado" && Number.isFinite(rawPagoMontoPen) ? Math.max(0, rawPagoMontoPen) : 0;
  try {
    const [exists] = await pool.query("SELECT id FROM scimanage_papers WHERE id = ? LIMIT 1", [id]);
    if (!Array.isArray(exists) || exists.length === 0) return res.status(404).json({ error: "not_found" });
    await pool.query(
      `UPDATE scimanage_papers SET
        titulo = ?, integrantes = ?, sede = ?, ods_json = ?, linea_investigacion = ?, pais_revista = ?,
        status = ?, link_revista = ?, pago_status = ?, pago_drive_url = ?, pago_monto_pen = ?, updated_at = ?
       WHERE id = ?`,
      [
        String(payload.titulo).trim(),
        Math.max(1, Number(payload.integrantes || 1)),
        String(payload.sede).trim(),
        JSON.stringify(Array.isArray(payload.ods) ? payload.ods : []),
        String(payload.lineaInvestigacion).trim(),
        String(payload.paisRevista).trim(),
        payload.status === "finalizado" ? "finalizado" : "en_proceso",
        String(payload.linkRevista || "").trim(),
        pagoStatus,
        String(payload.pagoDriveUrl || "").trim(),
        pagoMontoPen,
        toMysqlDateTime(payload.updatedAt || new Date().toISOString()),
        id,
      ]
    );
    const [rows] = await pool.query("SELECT * FROM scimanage_papers WHERE id = ? LIMIT 1", [id]);
    const row = Array.isArray(rows) && rows.length > 0 ? mapScimanagePaper(rows[0]) : null;
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.delete("/api/scimanage/papers/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "id_required" });
  try {
    await pool.query("DELETE FROM scimanage_papers WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// SciManage patents
app.get("/api/scimanage/patents", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, inventor, sede, categoria, status, link, numero_expediente, fecha_solicitud, created_at, updated_at
       FROM scimanage_patents
       ORDER BY created_at DESC`
    );
    const mapped = Array.isArray(rows) ? rows.map((row: any) => mapScimanagePatent(row)) : [];
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/api/scimanage/patents", async (req, res) => {
  const payload = req.body || {};
  if (!payload.nombre || !payload.inventor || !payload.sede || !payload.numeroExpediente) {
    return res.status(400).json({ error: "missing_required_fields" });
  }
  const id = String(payload.id || `pt-${uuid()}`);
  const fechaSolicitud = toDateOnly(payload.fechaSolicitud || "");
  if (!fechaSolicitud) return res.status(400).json({ error: "fecha_solicitud_invalida" });
  const now = new Date().toISOString();
  const createdAt = toMysqlDateTime(payload.createdAt || now);
  const updatedAt = toMysqlDateTime(payload.updatedAt || now);
  const categoria =
    payload.categoria === "modelo_utilidad" || payload.categoria === "diseno_industrial"
      ? payload.categoria
      : "modelo_inventiva";
  const status = payload.status === "finalizado" || payload.status === "en_proceso" ? payload.status : "inicio";
  try {
    await pool.query(
      `INSERT INTO scimanage_patents (
        id, nombre, inventor, sede, categoria, status, link, numero_expediente, fecha_solicitud, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        String(payload.nombre).trim(),
        String(payload.inventor).trim(),
        String(payload.sede).trim(),
        categoria,
        status,
        String(payload.link || "").trim(),
        String(payload.numeroExpediente).trim(),
        fechaSolicitud,
        createdAt,
        updatedAt,
      ]
    );
    const [rows] = await pool.query("SELECT * FROM scimanage_patents WHERE id = ? LIMIT 1", [id]);
    const row = Array.isArray(rows) && rows.length > 0 ? mapScimanagePatent(rows[0]) : null;
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.put("/api/scimanage/patents/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const payload = req.body || {};
  if (!id) return res.status(400).json({ error: "id_required" });
  if (!payload.nombre || !payload.inventor || !payload.sede || !payload.numeroExpediente) {
    return res.status(400).json({ error: "missing_required_fields" });
  }
  const fechaSolicitud = toDateOnly(payload.fechaSolicitud || "");
  if (!fechaSolicitud) return res.status(400).json({ error: "fecha_solicitud_invalida" });
  const categoria =
    payload.categoria === "modelo_utilidad" || payload.categoria === "diseno_industrial"
      ? payload.categoria
      : "modelo_inventiva";
  const status = payload.status === "finalizado" || payload.status === "en_proceso" ? payload.status : "inicio";
  try {
    const [exists] = await pool.query("SELECT id FROM scimanage_patents WHERE id = ? LIMIT 1", [id]);
    if (!Array.isArray(exists) || exists.length === 0) return res.status(404).json({ error: "not_found" });
    await pool.query(
      `UPDATE scimanage_patents SET
         nombre = ?, inventor = ?, sede = ?, categoria = ?, status = ?, link = ?, numero_expediente = ?,
         fecha_solicitud = ?, updated_at = ?
       WHERE id = ?`,
      [
        String(payload.nombre).trim(),
        String(payload.inventor).trim(),
        String(payload.sede).trim(),
        categoria,
        status,
        String(payload.link || "").trim(),
        String(payload.numeroExpediente).trim(),
        fechaSolicitud,
        toMysqlDateTime(payload.updatedAt || new Date().toISOString()),
        id,
      ]
    );
    const [rows] = await pool.query("SELECT * FROM scimanage_patents WHERE id = ? LIMIT 1", [id]);
    const row = Array.isArray(rows) && rows.length > 0 ? mapScimanagePatent(rows[0]) : null;
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.delete("/api/scimanage/patents/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "id_required" });
  try {
    await pool.query("DELETE FROM scimanage_patents WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

// Notifications
app.get("/notifications", async (req, res) => {
  const { userId } = req.query as { userId?: string };
  if (!userId) return res.status(400).json({ error: "userId_required" });
  try {
    const [rows] = await pool.query(
      `SELECT id, project_id, type, message, created_at, read_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/notifications/:id/read", async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET read_at = NOW() WHERE id = ?`, [req.params.id]);
    res.json({ id: req.params.id, read: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.get("/scimanage-papers/*", (_req, res) => {
  res.sendFile(path.join(paperStaticDir, "index.html"));
});
app.get("*", (_req, res) => {
  sendAppShell(res);
});

import fs from "fs";

async function initDatabase() {
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE 'users'");
    if ((rows as any).length === 0) {
      console.log("Database empty. Running init.sql...");
      const initSql = fs.readFileSync(path.join(__dirname, "../../init.sql"), "utf8");
      await pool.query(initSql);
      console.log("Database initialized successfully!");
    }
  } catch (err) {
    console.error("Error initializing database from init.sql:", err);
  }
}

async function startServer() {
  await initDatabase();
  try {
    await ensureProjectsOdsColumn();
    await ensureGlobalTaskAssignments();
  } catch (err) {
    console.error("Error inicializando tareas de Fellow:", err);
  }
  try {
    await ensureScimanageTables();
  } catch (err) {
    console.error("Error inicializando tablas de Scimanage:", err);
  }
  app.listen(PORT, () => {
    console.log(`API + static frontend running on http://localhost:${PORT}`);
  });
}

startServer();
