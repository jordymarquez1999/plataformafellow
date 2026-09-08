import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

const TRL_PASSWORD = (process.env.TRL_PASSWORD || process.env.APP_PASSWORD || "").trim();
const TRL_USER = process.env.TRL_GF_USER || "multimediafalab";
const TRL_GF_PASSWORD = (process.env.TRL_GF_PASSWORD || TRL_PASSWORD || "").trim();
const TRL_GF_API_KEY = (process.env.TRL_GF_API_KEY || process.env.TRL_GF_KEY || "").trim();
const TRL_GF_API_SECRET = (process.env.TRL_GF_API_SECRET || process.env.TRL_GF_SECRET || "").trim();
const TRL_GF_AUTH_HEADER = (process.env.TRL_GF_AUTH_HEADER || "").trim();
const TRL_GF_USER_AGENT = (process.env.TRL_GF_USER_AGENT || "fellowship-api/1.0").trim();
const TRL_GF_REFERER = (process.env.TRL_GF_REFERER || "").trim();
const TRL_GF_ORIGIN = (process.env.TRL_GF_ORIGIN || "").trim();
const TRL_GF_URL =
  process.env.TRL_GF_URL ||
  "https://fablab.ucontinental.edu.pe/wp-json/gf/v2/forms/9/entries";
const TRL_N8N_WEBHOOK_URL = (process.env.N8N_WEBHOOK_URL || "").trim();

const SEGMENTS = ["TRL 1-3", "TRL 4-7", "TRL 8-9"] as const;
const COLORS = {
  yes: "#27ae60",
  no: "#e74c3c",
  "TRL 1-3": "#3498db",
  "TRL 4-7": "#9b59b6",
  "TRL 8-9": "#e67e22",
  ubicacion: ["#3498db", "#2ecc71", "#e74c3c", "#f1c40f", "#95a5a6"],
};

const RENAME_MAP: Record<string, string> = {
  "22": "Nombre del Proyecto",
  "14": "Nivel TRL",
  "15": "Docente Acompanante",
  "17": "Nivel de Ingles",
  "30": "Ubicacion",
  "3": "Industria",
  "29": "Correo",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICT_PATH = path.join(__dirname, "..", "trl", "diccionario.csv");

type TrlOverrideEntry = {
  name: string;
  year?: number;
  setAt: string;
};

type TrlMigrationEntry = {
  name: string;
  fromYear?: number;
  toYear: number;
  entryId?: string;
  setAt: string;
};

type TrlEmailSendHistoryEntry = {
  email: string;
  sentAt: string;
};

type TrlEmailStatusEntry = {
  name: string;
  year?: number;
  sendCount: number;
  lastEmail: string;
  lastSentAt: string;
  history: TrlEmailSendHistoryEntry[];
};

type TrlOverrides = {
  forceApproved: Record<string, TrlOverrideEntry>;
  deletedProjects: Record<string, TrlOverrideEntry>;
  migratedProjects: Record<string, TrlMigrationEntry>;
  emailSends: Record<string, TrlEmailStatusEntry>;
};

let dictionaryCache: Record<string, Record<string, { puntaje: number; segmento: string }>> | null = null;
let trlCache: { updatedAt: number; rows: TrlRow[] } | null = null;
let overridesCache: TrlOverrides | null = null;
let overridesLoadPromise: Promise<TrlOverrides> | null = null;
let overridesTableEnsured = false;

function emptyOverrides(): TrlOverrides {
  return { forceApproved: {}, deletedProjects: {}, migratedProjects: {}, emailSends: {} };
}

function sanitizeOverrides(parsed: any): TrlOverrides {
  return {
    forceApproved: parsed?.forceApproved && typeof parsed.forceApproved === "object" ? parsed.forceApproved : {},
    deletedProjects: parsed?.deletedProjects && typeof parsed.deletedProjects === "object" ? parsed.deletedProjects : {},
    migratedProjects: parsed?.migratedProjects && typeof parsed.migratedProjects === "object" ? parsed.migratedProjects : {},
    emailSends: parsed?.emailSends && typeof parsed.emailSends === "object" ? parsed.emailSends : {},
  };
}

async function ensureOverridesLoaded(force = false) {
  if (!force && overridesCache) return overridesCache;
  if (!force && overridesLoadPromise) return overridesLoadPromise;

  const loader = (async () => {
    try {
      if (!overridesTableEnsured) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS trl_overrides_state (
            id TINYINT NOT NULL PRIMARY KEY,
            payload JSON NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        overridesTableEnsured = true;
      }
      const [rows]: any = await pool.query("SELECT payload FROM trl_overrides_state WHERE id = 1 LIMIT 1");
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (row) {
        const payloadRaw = row.payload;
        const parsedPayload =
          typeof payloadRaw === "string"
            ? JSON.parse(payloadRaw || "{}")
            : payloadRaw && typeof payloadRaw === "object"
              ? payloadRaw
              : {};
        overridesCache = sanitizeOverrides(parsedPayload);
        return overridesCache;
      }
      const fresh = emptyOverrides();
      await pool.query(
        `INSERT INTO trl_overrides_state (id, payload) VALUES (1, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(fresh)]
      );
      overridesCache = fresh;
      return overridesCache;
    } catch (err) {
      console.error("Error al leer overrides TRL desde BD:", err);
      overridesCache = emptyOverrides();
      return overridesCache;
    }
  })();

  overridesLoadPromise = loader;
  try {
    return await loader;
  } finally {
    overridesLoadPromise = null;
  }
}

function loadOverrides(): TrlOverrides {
  return overridesCache || emptyOverrides();
}

async function saveOverrides(overrides: TrlOverrides) {
  try {
    if (!overridesTableEnsured) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS trl_overrides_state (
          id TINYINT NOT NULL PRIMARY KEY,
          payload JSON NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      overridesTableEnsured = true;
    }
    const safe = sanitizeOverrides(overrides || {});
    await pool.query(
      `INSERT INTO trl_overrides_state (id, payload) VALUES (1, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(safe)]
    );
    overridesCache = safe;
  } catch (err) {
    console.error("Error al guardar overrides TRL en BD:", err);
    throw err;
  }
}

function normalizeKey(value: string) {
  return (value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeEntryId(value: unknown) {
  return String(value || "").trim();
}

function buildOverrideKey(name: string, year?: number) {
  const cleanName = normalizeKey(name);
  const cleanYear = Number.isFinite(year) ? String(year) : "all";
  return `${cleanYear}::${cleanName}`;
}

function isOverrideActive(map: Record<string, TrlOverrideEntry>, name: string, year?: number) {
  if (!name) return false;
  const key = buildOverrideKey(name, year);
  if (map[key]) return true;
  const fallbackKey = buildOverrideKey(name);
  return Boolean(map[fallbackKey]);
}

function findMigrationEntry(map: Record<string, TrlMigrationEntry>, name: string, year?: number, entryId?: string) {
  const cleanEntryId = normalizeEntryId(entryId);
  if (cleanEntryId) {
    const byId = Object.values(map).find((item) => normalizeEntryId(item?.entryId) === cleanEntryId);
    if (byId && Number.isFinite(Number(byId.toYear))) return byId;
  }
  if (!name) return null;
  const key = buildOverrideKey(name, year);
  const exact = map[key];
  if (exact && Number.isFinite(Number(exact.toYear))) return exact;
  const fallbackKey = buildOverrideKey(name);
  const fallback = map[fallbackKey];
  if (fallback && Number.isFinite(Number(fallback.toYear))) return fallback;
  return null;
}

function findEmailStatusEntry(map: Record<string, TrlEmailStatusEntry>, name: string, year?: number) {
  if (!name) return null;
  const key = buildOverrideKey(name, year);
  const exact = map[key];
  if (exact) return exact;
  const fallbackKey = buildOverrideKey(name);
  return map[fallbackKey] || null;
}

async function registerEmailSend(name: string, email: string, year?: number) {
  const overrides = await ensureOverridesLoaded();
  const key = buildOverrideKey(name, year);
  const current = overrides.emailSends[key];
  const safeHistory = Array.isArray(current?.history)
    ? current.history.filter((item) => item && typeof item.email === "string" && typeof item.sentAt === "string")
    : [];
  const sentAt = new Date().toISOString();
  const next: TrlEmailStatusEntry = {
    name,
    year,
    sendCount: (Number(current?.sendCount) || safeHistory.length) + 1,
    lastEmail: email,
    lastSentAt: sentAt,
    history: [...safeHistory, { email, sentAt }],
  };
  overrides.emailSends[key] = next;
  await saveOverrides(overrides);
  return next;
}

function applyYearMigrations(rows: TrlRow[]) {
  const overrides = loadOverrides();
  if (!Object.keys(overrides.migratedProjects).length) return rows;
  return rows.map((row) => {
    const nombre = String(row["Nombre del Proyecto"] || "");
    const originalYear = Number(row["Anio Registro Original"] || row["Anio Registro"]) || undefined;
    const entryId = normalizeEntryId((row as any)?.id ?? (row as any)?.entry_id ?? (row as any)?.entryId);
    const migration = findMigrationEntry(overrides.migratedProjects, nombre, originalYear, entryId);
    if (!migration) return row;
    const toYear = Number(migration.toYear);
    if (!Number.isFinite(toYear)) return row;
    return {
      ...row,
      "Anio Registro": toYear,
      "Anio Registro Original": originalYear,
    };
  });
}

const TEMPLATE_CSS = `:root {
  --primary-color: #4f46e5;
  --secondary-color: #10b981;
  --accent-color: #f59e0b;
  --dark-color: #1e293b;
  --light-color: #f8fafc;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --danger-color: #ef4444;
  --gray-light: #e2e8f0;
  --gray-medium: #94a3b8;
}

body {
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  margin: 0;
  padding: 2rem;
  color: var(--dark-color);
  line-height: 1.6;
  background-color: #ffffff;
}

.header {
  text-align: center;
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--gray-light);
}

.title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
  letter-spacing: -0.5px;
}

.subtitle {
  font-size: 1.1rem;
  color: var(--gray-medium);
  font-weight: 400;
}

.date {
  color: var(--gray-medium);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.report-container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  padding: 2.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background-color: white;
  border-radius: 0.5rem;
  border: 1px solid var(--gray-light);
}

.section-title {
  font-weight: 600;
  font-size: 1.2rem;
  color: var(--primary-color);
  margin-bottom: 1.2rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--primary-color);
  display: flex;
  align-items: center;
}

.section-title svg {
  margin-right: 0.5rem;
  width: 1.2rem;
  height: 1.2rem;
}

.row {
  display: flex;
  margin-bottom: 1rem;
  align-items: center;
}

.label {
  width: 220px;
  font-weight: 500;
  color: var(--dark-color);
  font-size: 0.95rem;
}

.value {
  flex: 1;
  font-size: 0.95rem;
}

.approval-status {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 1rem;
  border-radius: 1rem;
  font-weight: 500;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.approved {
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
  border: 1px solid var(--success-color);
}

.rejected {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--danger-color);
  border: 1px solid var(--danger-color);
}

.progress-container {
  width: 100%;
  margin-top: 0.5rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.3rem;
  font-size: 0.85rem;
}

.progress-bar {
  height: 10px;
  background-color: var(--gray-light);
  border-radius: 5px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.progress-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease;
  position: relative;
  overflow: hidden;
}

.progress-fill::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: linear-gradient(
    to right,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.4) 50%,
    rgba(255, 255, 255, 0.2) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

.progress-fill.trl1-3 {
  background-color: var(--primary-color);
  background-image: linear-gradient(to right, #6366f1, #4f46e5);
}

.progress-fill.trl4-7 {
  background-color: var(--success-color);
  background-image: linear-gradient(to right, #34d399, #10b981);
}

.progress-fill.trl8-9 {
  background-color: #8b5cf6;
  background-image: linear-gradient(to right, #a78bfa, #8b5cf6);
}

.footer {
  margin-top: 3rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--gray-medium);
  border-top: 1px solid var(--gray-light);
  padding-top: 1rem;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media print {
  body {
    padding: 0;
    font-size: 11pt;
    background: white;
  }

  .report-container {
    padding: 1.5rem;
    box-shadow: none;
  }

  .no-print {
    display: none !important;
  }

  .section {
    page-break-inside: avoid;
    border: none;
    padding: 0.5rem 0;
  }

  .progress-fill::after {
    display: none;
  }
}
`;

type TrlRow = {
  [key: string]: any;
  "Nombre del Proyecto"?: string;
  "Nivel TRL"?: number;
  "Docente Acompanante"?: boolean;
  "Nivel de Ingles"?: string;
  "Ubicacion"?: string;
  "Industria"?: string;
  "Correo"?: string;
  "Segmento TRL"?: string;
  "Puntaje TRL 1-3"?: number;
  "Puntaje TRL 4-7"?: number;
  "Puntaje TRL 8-9"?: number;
  "Puntaje Total"?: number;
  Aprobado?: "Si" | "No";
  AprobadoForzado?: boolean;
  Insights?: string[];
  "Fecha Registro"?: string;
  "Anio Registro"?: number;
  "Anio Registro Original"?: number;
};

function findRowByName(rows: TrlRow[], name: string) {
  const needle = normalizeKey(name);
  if (!needle) return null;
  return rows.find((row) => normalizeKey(String(row["Nombre del Proyecto"] || "")) === needle) || null;
}

function findRowByEntryId(rows: TrlRow[], entryId: string) {
  const needle = normalizeEntryId(entryId);
  if (!needle) return null;
  return (
    rows.find((row) => {
      const rowEntryId = normalizeEntryId((row as any)?.id ?? (row as any)?.entry_id ?? (row as any)?.entryId);
      return rowEntryId === needle;
    }) || null
  );
}

function normalizePassword(value: string) {
  return (value || "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/\u200B/g, "")
    .replace(/\uFEFF/g, "")
    .trim();
}

function buildGravityAuthHeader() {
  if (TRL_GF_AUTH_HEADER) return TRL_GF_AUTH_HEADER;
  if (TRL_GF_API_KEY && TRL_GF_API_SECRET) {
    const key = normalizePassword(TRL_GF_API_KEY);
    const secret = normalizePassword(TRL_GF_API_SECRET);
    return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
  }
  if (!TRL_GF_PASSWORD) {
    throw new Error("Credenciales Gravity Forms faltantes. Usa TRL_GF_API_KEY/TRL_GF_API_SECRET o TRL_GF_USER/TRL_GF_PASSWORD.");
  }
  const authPassword = normalizePassword(TRL_GF_PASSWORD);
  return `Basic ${Buffer.from(`${TRL_USER}:${authPassword}`).toString("base64")}`;
}

function matchesPassword(password: string) {
  if (!TRL_PASSWORD) return true;
  if (password === TRL_PASSWORD) return true;
  const clean = normalizePassword(password);
  const expected = normalizePassword(TRL_PASSWORD);
  return clean === expected;
}

function parseBasicPassword(authHeader?: string) {
  if (!authHeader) return "";
  const [type, token] = authHeader.split(" ");
  if (!token || type.toLowerCase() !== "basic") return "";
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  if (idx === -1) return "";
  return decoded.slice(idx + 1);
}

function requireTrlAuth(req: Request, res: Response) {
  const password = parseBasicPassword(req.headers.authorization);
  if (!matchesPassword(password)) {
    res.status(401).json({ error: "invalid_password" });
    return false;
  }
  return true;
}

function requireAuthQuery(auth?: string) {
  if (!TRL_PASSWORD) return true;
  if (!auth) return false;
  try {
    const decoded = Buffer.from(auth, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return false;
    const password = decoded.slice(idx + 1);
    return matchesPassword(password);
  } catch {
    return false;
  }
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      current.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      current.push(field);
      if (current.length > 1 || current[0] !== "") {
        rows.push(current);
      }
      current = [];
      field = "";
      continue;
    }
    field += char;
  }
  current.push(field);
  if (current.length > 1 || current[0] !== "") rows.push(current);
  return rows;
}

function loadDictionary() {
  if (dictionaryCache) return dictionaryCache;
  if (!fs.existsSync(DICT_PATH)) {
    throw new Error(`Dictionary not found at ${DICT_PATH}`);
  }
  const raw = fs.readFileSync(DICT_PATH, "utf8");
  const rows = parseCsv(raw);
  const header = rows[0] || [];
  const idxSegment = header.indexOf("Segmento TRL");
  const idxPregunta = header.indexOf("Pregunta");
  const idxRespuesta = header.indexOf("Respuesta");
  const idxPuntaje = header.indexOf("Puntaje");
  const map: Record<string, Record<string, { puntaje: number; segmento: string }>> = {};
  for (const row of rows.slice(1)) {
    const segmento = (row[idxSegment] || "").trim();
    const pregunta = (row[idxPregunta] || "").trim();
    const respuesta = (row[idxRespuesta] || "").trim();
    const puntaje = Number(row[idxPuntaje] || 0) || 0;
    if (!pregunta || !respuesta || !segmento) continue;
    if (!map[pregunta]) map[pregunta] = {};
    map[pregunta][respuesta] = { puntaje, segmento };
  }
  dictionaryCache = map;
  return map;
}

async function fetchGravityEntries() {
  const authHeader = buildGravityAuthHeader();
  const allEntries: Record<string, any>[] = [];
  let page = 1;
  while (true) {
    const url = new URL(TRL_GF_URL);
    url.searchParams.set("paging[page_size]", "100");
    url.searchParams.set("paging[current_page]", String(page));
    url.searchParams.set("status", "active");
    url.searchParams.set("cache_bust", String(Date.now()));
    const headers: Record<string, string> = {
      Authorization: authHeader,
      Accept: "application/json",
      "User-Agent": TRL_GF_USER_AGENT,
    };
    if (TRL_GF_REFERER) headers.Referer = TRL_GF_REFERER;
    if (TRL_GF_ORIGIN) headers.Origin = TRL_GF_ORIGIN;
    const res = await fetch(url.toString(), {
      headers,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GravityForms error ${res.status}: ${text}`);
    }
    const data: any = await res.json();
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    const total = Number(data?.total_count || entries.length || 0);
    allEntries.push(...entries);
    if (allEntries.length >= total) break;
    page += 1;
  }

  const allKeys = new Set<string>();
  for (const entry of allEntries) {
    Object.keys(entry || {}).forEach((key) => allKeys.add(key));
  }
  for (const entry of allEntries) {
    for (const key of allKeys) {
      if (!(key in entry)) entry[key] = null;
    }
  }
  return allEntries;
}

function renameEntry(entry: Record<string, any>) {
  const renamed: Record<string, any> = {};
  for (const [key, value] of Object.entries(entry)) {
    const mapped = RENAME_MAP[key] || key;
    renamed[mapped] = value;
  }
  if (!renamed["Nombre del Proyecto"] && entry["1"]) {
    renamed["Nombre del Proyecto"] = entry["1"];
  }
  return renamed;
}

function segmentoTrl(nivel: number) {
  if (nivel >= 1 && nivel <= 3) return "TRL 1-3";
  if (nivel >= 4 && nivel <= 7) return "TRL 4-7";
  if (nivel >= 8 && nivel <= 9) return "TRL 8-9";
  return "Desconocido";
}

function calcularPuntajesPorSegmento(
  row: Record<string, any>,
  dictionary: Record<string, Record<string, { puntaje: number; segmento: string }>>
) {
  const puntajes: Record<string, number> = { "TRL 1-3": 0, "TRL 4-7": 0, "TRL 8-9": 0 };
  const values = Object.values(row);
  for (const respuestas of Object.values(dictionary)) {
    for (const value of values) {
      if (value === null || value === undefined) continue;
      const text = String(value).trim();
      if (!text) continue;
      const hit = respuestas[text];
      if (hit) {
        puntajes[hit.segmento] = (puntajes[hit.segmento] || 0) + Number(hit.puntaje || 0);
      }
    }
  }
  return puntajes;
}

function capitalizeText(value: string) {
  if (!value) return value;
  const text = value.trim().toLowerCase();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function formatNivelIngles(value: string) {
  const text = value.trim().toLowerCase();
  if (text === "basico" || text === "básico") return "Básico";
  return capitalizeText(value);
}

function esNivelInglesBasico(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  return text === "basico" || text === "básico";
}

function parseGravityDate(value: string | null | undefined) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const iso = text.includes("T") ? text : text.replace(" ", "T");
  const withZone = iso.endsWith("Z") ? iso : `${iso}Z`;
  const date = new Date(withZone);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getEntryYear(entry: Record<string, any>) {
  const date = parseGravityDate(entry?.date_created || entry?.date_updated);
  return date ? date.getUTCFullYear() : null;
}

function parseSortableDate(value: unknown) {
  const date = parseGravityDate(typeof value === "string" ? value : "");
  return date ? date.getTime() : 0;
}

function getRowEntryId(row: Record<string, any>) {
  return normalizeEntryId(row?.id ?? row?.entry_id ?? row?.entryId);
}

function shouldKeepCandidateRow(current: TrlRow, candidate: TrlRow) {
  const currentTs = parseSortableDate((current as any)?.date_updated || (current as any)?.date_created || current["Fecha Registro"]);
  const candidateTs = parseSortableDate((candidate as any)?.date_updated || (candidate as any)?.date_created || candidate["Fecha Registro"]);
  if (candidateTs > currentTs) return true;
  if (candidateTs < currentTs) return false;

  const currentIdRaw = getRowEntryId(current as Record<string, any>);
  const candidateIdRaw = getRowEntryId(candidate as Record<string, any>);
  const currentId = Number.parseInt(currentIdRaw, 10);
  const candidateId = Number.parseInt(candidateIdRaw, 10);
  const currentIdValid = Number.isFinite(currentId);
  const candidateIdValid = Number.isFinite(candidateId);
  if (candidateIdValid && !currentIdValid) return true;
  if (!candidateIdValid && currentIdValid) return false;
  if (candidateIdValid && currentIdValid) return candidateId > currentId;
  return false;
}

function deduplicateRowsByNameAndYear(rows: TrlRow[]) {
  const unique = new Map<string, TrlRow>();
  let fallbackIdx = 0;
  for (const row of rows) {
    const nombre = normalizeKey(String(row["Nombre del Proyecto"] || ""));
    if (!nombre) {
      fallbackIdx += 1;
      const fallbackKey = `id::${getRowEntryId(row as Record<string, any>)}::${fallbackIdx}`;
      unique.set(fallbackKey, row);
      continue;
    }
    const rowYear = Number(row["Anio Registro"] || row["Anio Registro Original"] || 0);
    const yearKey = Number.isFinite(rowYear) && rowYear > 0 ? String(rowYear) : "all";
    const dedupeKey = `${yearKey}::${nombre}`;
    const current = unique.get(dedupeKey);
    if (!current) {
      unique.set(dedupeKey, row);
      continue;
    }
    if (shouldKeepCandidateRow(current, row)) {
      unique.set(dedupeKey, row);
    }
  }
  return Array.from(unique.values());
}

function listDeletedProjects(year?: number) {
  const overrides = loadOverrides();
  const unique = new Map<string, TrlOverrideEntry>();
  for (const item of Object.values(overrides.deletedProjects || {})) {
    if (!item || typeof item.name !== "string") continue;
    const itemYear = Number(item.year || 0) || undefined;
    if (year && itemYear && Number(itemYear) !== Number(year)) continue;
    const key = buildOverrideKey(item.name, itemYear);
    const current = unique.get(key);
    if (!current || parseSortableDate(item.setAt) > parseSortableDate(current.setAt)) {
      unique.set(key, { name: item.name, year: itemYear, setAt: String(item.setAt || "") });
    }
  }
  return Array.from(unique.values()).sort((a, b) => {
    const delta = parseSortableDate(b.setAt) - parseSortableDate(a.setAt);
    if (delta !== 0) return delta;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}
function analizarMadurez(proyecto: TrlRow, segmento: string) {
  const trl1 = Number(proyecto["Puntaje TRL 1-3"] || 0);
  const trl47 = Number(proyecto["Puntaje TRL 4-7"] || 0);
  const trl89 = Number(proyecto["Puntaje TRL 8-9"] || 0);
  if (segmento === "TRL 1-3") {
    return trl1 >= 40
      ? "Investigación sólida: buen fundamento teórico y validación inicial"
      : "Etapa conceptual: necesita más desarrollo teórico y validación";
  }
  if (segmento === "TRL 4-7") {
    return trl47 >= 50
      ? "Prototipo funcional: validación técnica en progreso"
      : "Prototipo inicial: requiere más desarrollo técnico";
  }
  return trl89 >= 60
    ? "Listo para implementación: alta preparación para el mercado"
    : "Casi listo: necesita ajustes finales para implementación";
}

function identificarFortalezas(proyecto: TrlRow) {
  const fortalezas: string[] = [];
  if (Number(proyecto["Puntaje TRL 1-3"] || 0) >= 40) {
    fortalezas.push("Innovación bien fundamentada con investigación sólida");
  }
  if (Number(proyecto["Puntaje TRL 4-7"] || 0) >= 50) {
    fortalezas.push("Desarrollo técnico avanzado y validado");
  }
  if (Number(proyecto["Puntaje TRL 8-9"] || 0) >= 50) {
    fortalezas.push("Alto potencial de implementación y escalabilidad");
  }
  if (proyecto["Docente Acompanante"]) {
    fortalezas.push("Buen acompañamiento académico");
  }
  const nivel = proyecto["Nivel de Ingles"] || "";
  if (nivel === "Avanzado" || nivel === "Intermedio") {
    fortalezas.push("Buena capacidad para documentación internacional");
  }
  return fortalezas;
}

function identificarDebilidades(proyecto: TrlRow) {
  const debilidades: string[] = [];
  if (Number(proyecto["Puntaje TRL 1-3"] || 0) < 30) {
    debilidades.push("Fundamentación teórica débil - necesita más investigación");
  }
  if (Number(proyecto["Puntaje TRL 4-7"] || 0) < 40) {
    debilidades.push("Desarrollo técnico insuficiente - requiere más validación");
  }
  if (Number(proyecto["Puntaje TRL 8-9"] || 0) < 40) {
    debilidades.push("Preparación para el mercado limitada - necesita más desarrollo");
  }
  if (!proyecto["Docente Acompanante"]) {
    debilidades.push("Falta acompañamiento docente - recomendar mentoría");
  }
  if (esNivelInglesBasico(proyecto["Nivel de Ingles"])) {
    debilidades.push("Limitaciones en inglés - afecta potencial internacional");
  }
  return debilidades;
}

function generarRecomendaciones(proyecto: TrlRow) {
  const recomendaciones: string[] = [];
  const segmento = segmentoTrl(Number(proyecto["Nivel TRL"] || 0));
  if (segmento === "TRL 1-3") {
    recomendaciones.push("Priorizar investigación y validación conceptual");
    if (Number(proyecto["Puntaje TRL 1-3"] || 0) < 30) {
      recomendaciones.push("Realizar más investigación de mercado y técnica");
    }
  } else if (segmento === "TRL 4-7") {
    recomendaciones.push("Enfocarse en desarrollo técnico y pruebas");
    if (Number(proyecto["Puntaje TRL 4-7"] || 0) < 40) {
      recomendaciones.push("Realizar pruebas técnicas más rigurosas");
    }
  } else {
    recomendaciones.push("Preparar estrategia de implementación y comercialización");
    if (Number(proyecto["Puntaje TRL 8-9"] || 0) < 50) {
      recomendaciones.push("Realizar pruebas piloto con usuarios finales");
    }
  }
  if (!proyecto["Docente Acompanante"]) {
    recomendaciones.push("Buscar mentoría docente para fortalecer el proyecto");
  }
  if (esNivelInglesBasico(proyecto["Nivel de Ingles"])) {
    recomendaciones.push("Mejorar documentación en inglés para mayor impacto");
  }
  return recomendaciones;
}

function evaluarPotencial(proyecto: TrlRow) {
  const total =
    Number(proyecto["Puntaje TRL 1-3"] || 0) +
    Number(proyecto["Puntaje TRL 4-7"] || 0) +
    Number(proyecto["Puntaje TRL 8-9"] || 0);
  if (total >= 120) return "Excelente potencial: proyecto bien desarrollado en todas las áreas";
  if (total >= 80) return "Buen potencial: proyecto sólido con algunas áreas para mejorar";
  if (total >= 50) return "Potencial moderado: necesita trabajo en varias áreas";
  return "Potencial limitado: requiere desarrollo significativo";
}

function generarInsights(proyecto: TrlRow) {
  const insights: string[] = [];
  const segmento = segmentoTrl(Number(proyecto["Nivel TRL"] || 0));
  insights.push(analizarMadurez(proyecto, segmento));
  insights.push(...identificarFortalezas(proyecto));
  insights.push(...identificarDebilidades(proyecto));
  insights.push(...generarRecomendaciones(proyecto));
  insights.push(evaluarPotencial(proyecto));
  const industria = proyecto["Industria"] || "No especificada";
  insights.push(`Sector: ${industria} - considerar tendencias del mercado relacionadas`);
  return insights;
}

function processEntries(entries: Record<string, any>[]) {
  const dictionary = loadDictionary();
  const rows: TrlRow[] = [];

  for (const entry of entries) {
    const renamed = renameEntry(entry);
    const entryYear = getEntryYear(entry);
    const entryDate = entry?.date_created || null;
    const nivelRaw = renamed["Nivel TRL"];
    const nivel = Number.parseFloat(String(nivelRaw ?? ""));
    const nivelTrl = Number.isFinite(nivel) ? nivel : 0;
    const segmento = segmentoTrl(nivelTrl);

    const puntajes = calcularPuntajesPorSegmento(renamed, dictionary);
    let extra = 0;
    const nivelInglesRaw = String(renamed["Nivel de Ingles"] || "").trim().toLowerCase();
    if (nivelInglesRaw.includes("intermedio")) extra += 2;
    if (nivelInglesRaw.includes("avanzado")) extra += 4;
    const docenteRaw = String(renamed["Docente Acompanante"] || "").trim().toLowerCase();
    if (docenteRaw === "si") extra += 10;

    const puntaje13 = (puntajes["TRL 1-3"] || 0) + extra;
    const puntaje47 = (puntajes["TRL 4-7"] || 0) + extra;
    const puntaje89 = (puntajes["TRL 8-9"] || 0) + extra;
    const aprobado = [puntaje13, puntaje47, puntaje89].some((p) => p >= 50) ? "Si" : "No";

    const docenteBool = docenteRaw === "si";
    const nivelIngles = nivelInglesRaw ? formatNivelIngles(nivelInglesRaw) : "No especificado";
    const ubicacionRaw = String(renamed["Ubicacion"] || "").trim();
    const ubicacion = ubicacionRaw ? capitalizeText(ubicacionRaw) : "No especificada";
    const industriaRaw = String(renamed["Industria"] || "").trim();
    const industria = industriaRaw || "No especificada";

    const row: TrlRow = {
      ...renamed,
      "Nivel TRL": nivelTrl,
      "Segmento TRL": segmento,
      "Puntaje TRL 1-3": Math.round(puntaje13 * 10) / 10,
      "Puntaje TRL 4-7": Math.round(puntaje47 * 10) / 10,
      "Puntaje TRL 8-9": Math.round(puntaje89 * 10) / 10,
      "Puntaje Total": Math.round((puntaje13 + puntaje47 + puntaje89) * 10) / 10,
      Aprobado: aprobado,
      "Docente Acompanante": docenteBool,
      "Nivel de Ingles": nivelIngles,
      Ubicacion: ubicacion,
      Industria: industria,
      "Fecha Registro": entryDate ? String(entryDate) : undefined,
      "Anio Registro": entryYear ?? undefined,
      "Anio Registro Original": entryYear ?? undefined,
    };

    row.Insights = generarInsights(row);
    rows.push(row);
  }

  return rows;
}

function filterRowsByYear(rows: TrlRow[], year?: number) {
  const migratedRows = applyYearMigrations(rows);
  const dedupedRows = deduplicateRowsByNameAndYear(migratedRows);
  if (!year || !Number.isFinite(year)) return dedupedRows;
  return dedupedRows.filter((row) => Number(row["Anio Registro"]) === Number(year));
}

function applyTrlOverrides(rows: TrlRow[]) {
  const overrides = loadOverrides();
  const result: TrlRow[] = [];
  for (const row of rows) {
    const nombre = String(row["Nombre del Proyecto"] || "");
    const rowYear = Number(row["Anio Registro"]) || undefined;
    if (isOverrideActive(overrides.deletedProjects, nombre, rowYear)) continue;
    const forced = isOverrideActive(overrides.forceApproved, nombre, rowYear);
    if (forced) {
      result.push({ ...row, Aprobado: "Si", AprobadoForzado: true });
    } else {
      result.push({ ...row, AprobadoForzado: false });
    }
  }
  return result;
}
function buildLayout(title: string) {
  return {
    title: { text: `<b>${title}</b>`, x: 0.5, y: 0.95 },
    font: { family: "Arial", size: 14, color: "#34495e" },
    plot_bgcolor: "#ffffff",
    paper_bgcolor: "#f8f9fa",
    margin: { l: 50, r: 50, t: 80, b: 70 },
    legend: { orientation: "h", y: -0.25, x: 0.5, xanchor: "center" },
  };
}

function buildCharts(rows: TrlRow[]) {
  const segmentCounts: Record<string, number> = { "TRL 1-3": 0, "TRL 4-7": 0, "TRL 8-9": 0 };
  for (const row of rows) {
    if (row.Aprobado !== "Si") continue;
    for (const segment of SEGMENTS) {
      const key = `Puntaje ${segment}`;
      const value = Number((row as any)[key] || 0);
      if (value >= 50) segmentCounts[segment] += 1;
    }
  }

  const fig1 = {
    data: [
      {
        type: "bar",
        x: SEGMENTS,
        y: SEGMENTS.map((s) => segmentCounts[s]),
        marker: { color: SEGMENTS.map((s) => COLORS[s]) },
        text: SEGMENTS.map((s) => segmentCounts[s]),
        textposition: "outside",
      },
    ],
    layout: {
      ...buildLayout("Aprobados por Nivel TRL"),
      xaxis: { title: "Segmento TRL", tickangle: -30 },
      yaxis: { title: "Número de Proyectos" },
      showlegend: false,
      height: 600,
    },
  };

  const aprobadoCounts = rows.reduce(
    (acc, row) => {
      acc[row.Aprobado === "Si" ? "Si" : "No"] += 1;
      return acc;
    },
    { Si: 0, No: 0 }
  );
  const fig2 = {
    data: [
      {
        type: "pie",
        labels: ["Sí", "No"],
        values: [aprobadoCounts.Si, aprobadoCounts.No],
        hole: 0.4,
        marker: { colors: [COLORS.yes, COLORS.no] },
        textinfo: "percent+label",
      },
    ],
    layout: { ...buildLayout("Proyectos Aprobados"), showlegend: false, height: 600 },
  };

  const segmentApproval: Record<string, { Si: number; No: number }> = {
    "TRL 1-3": { Si: 0, No: 0 },
    "TRL 4-7": { Si: 0, No: 0 },
    "TRL 8-9": { Si: 0, No: 0 },
  };
  for (const row of rows) {
    for (const segment of SEGMENTS) {
      const key = `Puntaje ${segment}`;
      const value = Number((row as any)[key] || 0);
      if (value >= 50) segmentApproval[segment].Si += 1;
      else segmentApproval[segment].No += 1;
    }
  }
  const fig3 = {
    data: [
      { type: "bar", name: "Sí", x: SEGMENTS, y: SEGMENTS.map((s) => segmentApproval[s].Si), marker: { color: COLORS.yes } },
      { type: "bar", name: "No", x: SEGMENTS, y: SEGMENTS.map((s) => segmentApproval[s].No), marker: { color: COLORS.no } },
    ],
    layout: {
      ...buildLayout("Aprobación por Segmento TRL"),
      xaxis: { title: "Segmento TRL", tickangle: -30 },
      yaxis: { title: "Número de Proyectos" },
      barmode: "group",
      height: 600,
    },
  };

  const fig4 = {
    data: [
      {
        type: "histogram",
        x: rows.map((row) => Number(row["Puntaje TRL 1-3"] || 0)),
        nbinsx: 20,
        marker: { color: COLORS["TRL 1-3"] },
      },
    ],
    layout: { ...buildLayout("Puntajes TRL 1-3"), xaxis: { title: "Puntaje", tickangle: -30 }, yaxis: { title: "Número de Proyectos" }, height: 600 },
  };

  const industriaCounts: Record<string, number> = {};
  for (const row of rows) {
    const industria = row.Industria || "No especificada";
    industriaCounts[industria] = (industriaCounts[industria] || 0) + 1;
  }
  const industriaLabels = Object.keys(industriaCounts);
  const industriaValues = industriaLabels.map((key) => industriaCounts[key]);
  const fig5 = {
    data: [
      {
        type: "bar",
        x: industriaValues,
        y: industriaLabels,
        orientation: "h",
      },
    ],
    layout: { ...buildLayout("Proyectos por Industria"), height: 600, showlegend: false },
  };

  const inglesCounts: Record<string, number> = {};
  for (const row of rows) {
    const nivel = row["Nivel de Ingles"] || "No especificado";
    inglesCounts[nivel] = (inglesCounts[nivel] || 0) + 1;
  }
  const inglesLabels = Object.keys(inglesCounts);
  const inglesValues = inglesLabels.map((key) => inglesCounts[key]);
  const fig6 = {
    data: [
      {
        type: "bar",
        x: inglesLabels,
        y: inglesValues,
      },
    ],
    layout: { ...buildLayout("Nivel de Inglés"), height: 600, showlegend: false },
  };

  const ubicacionCounts: Record<string, number> = {};
  for (const row of rows) {
    const ubicacion = row.Ubicacion || "No especificada";
    ubicacionCounts[ubicacion] = (ubicacionCounts[ubicacion] || 0) + 1;
  }
  const ubicacionLabels = Object.keys(ubicacionCounts);
  const ubicacionValues = ubicacionLabels.map((key) => ubicacionCounts[key]);
  const fig7 = {
    data: [
      {
        type: "pie",
        labels: ubicacionLabels,
        values: ubicacionValues,
        hole: 0.3,
        marker: { colors: COLORS.ubicacion },
        textinfo: "percent+label",
      },
    ],
    layout: { ...buildLayout("Ubicación Geográfica"), height: 600, showlegend: false },
  };

  return {
    grafico_1: JSON.stringify(fig1),
    grafico_2: JSON.stringify(fig2),
    grafico_3: JSON.stringify(fig3),
    grafico_4: JSON.stringify(fig4),
    grafico_5: JSON.stringify(fig5),
    grafico_6: JSON.stringify(fig6),
    grafico_7: JSON.stringify(fig7),
  };
}

function toCsv(rows: TrlRow[]) {
  const columns = [
    "Nombre del Proyecto",
    "Aprobado",
    "Nivel TRL",
    "Segmento TRL",
    "Docente Acompanante",
    "Ubicacion",
    "Nivel de Ingles",
    "Puntaje TRL 1-3",
    "Puntaje TRL 4-7",
    "Puntaje TRL 8-9",
    "Puntaje Total",
    "Insights",
  ];
  const escapeCell = (value: any) => {
    if (value === null || value === undefined) return "";
    let text = Array.isArray(value) ? value.join(" | ") : String(value);
    text = text.replace(/"/g, '""');
    if (text.includes(",") || text.includes("\n") || text.includes("\r")) {
      return `"${text}"`;
    }
    return text;
  };
  const lines = [columns.join(",")];
  for (const row of rows) {
    const line = columns.map((col) => escapeCell((row as any)[col])).join(",");
    lines.push(line);
  }
  return lines.join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function renderReportHtmlProject(row: TrlRow, generatedAt: string) {
  const aprobadoClass = row.Aprobado === "Si" ? "approved" : "rejected";
  const aprobadoText = row.Aprobado === "Si" ? "Sí" : "No";
  const docenteText = row["Docente Acompanante"] ? "Sí" : "No";
  const insights = Array.isArray(row.Insights) ? row.Insights : [];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reporte TRL</title>
  <style>${TEMPLATE_CSS}</style>
  <style>@media print { .no-print { display: none !important; } }</style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div class="title">Reporte de Evaluación de Proyecto</div>
      <div class="subtitle">Sistema de Gestión TRL - Universidad Continental</div>
      <div class="date">Generado el: ${escapeHtml(generatedAt)}</div>
    </div>

    <div class="section">
      <div class="section-title">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        Información del Proyecto
      </div>

      <div class="row">
        <div class="label">Nombre del Proyecto:</div>
        <div class="value">${escapeHtml(String(row["Nombre del Proyecto"] || ""))}</div>
      </div>
      <div class="row">
        <div class="label">Estado de Aprobación:</div>
        <div class="value">
          <span class="approval-status ${aprobadoClass}">${aprobadoText}</span>
        </div>
      </div>
      <div class="row">
        <div class="label">Nivel TRL:</div>
        <div class="value">${escapeHtml(String(row["Nivel TRL"] || ""))}</div>
      </div>
      <div class="row">
        <div class="label">Docente Acompañante:</div>
        <div class="value">${docenteText}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Resultados de Evaluación
      </div>

      ${[
        ["TRL 1-3 (Básico)", row["Puntaje TRL 1-3"], "trl1-3"],
        ["TRL 4-7 (Intermedio)", row["Puntaje TRL 4-7"], "trl4-7"],
        ["TRL 8-9 (Avanzado)", row["Puntaje TRL 8-9"], "trl8-9"],
      ]
        .map(([label, score, className]) => {
          const value = Number(score || 0);
          const status = value >= 50 ? "Competencia alcanzada" : "En desarrollo";
          return `<div class="row">
            <div class="label">${label}:</div>
            <div class="value">
              <div class="progress-info">
                <span>Puntaje: ${value}%</span>
                <span>${status}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill ${className}" style="width: ${value}%"></div>
              </div>
            </div>
          </div>`;
        })
        .join("")}

      ${
        insights.length
          ? `<div class="row" style="margin-top: 1rem; align-items: flex-start;">
              <div class="label" style="margin-top: 0.2rem;">Insights:</div>
              <div class="value">
                <ul style="list-style-type: disc; padding-left: 1.2rem; margin: 0;">
                  ${insights.map((item) => `<li style="margin-bottom: 0.4rem;">${escapeHtml(item)}</li>`).join("")}
                </ul>
              </div>
            </div>`
          : ""
      }

      <div class="footer">
        Reporte generado automáticamente por el Sistema TRL - Universidad Continental
      </div>

      <div class="no-print" style="margin-top: 2rem; text-align: center">
        <button onclick="window.print()" style="padding: 0.6rem 1.5rem; background-color: var(--primary-color); color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500; transition: background-color 0.2s;">
          Imprimir Reporte
        </button>
      </div>
      <script>
        window.onload = function () {
          setTimeout(() => {
            window.print();
            window.onafterprint = function () { window.close(); };
          }, 500);
        };
      </script>
    </div>
  </div>
</body>
</html>`;
}

function renderReportListHtml(rows: TrlRow[], title: string, generatedAt: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${TEMPLATE_CSS}</style>
  <style>@media print { .no-print { display: none !important; } }</style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div class="title">${escapeHtml(title)}</div>
      <div class="subtitle">Sistema de Gestión TRL - Universidad Continental</div>
      <div class="date">Generado el: ${escapeHtml(generatedAt)}</div>
    </div>
    ${rows
      .map((row) => {
        const docenteText = row["Docente Acompanante"] ? "Sí" : "No";
        const insights = Array.isArray(row.Insights) ? row.Insights : [];
        return `
        <div class="section" style="margin-top: 2.5rem; border-top: 2px solid #ddd; padding-top: 1.5rem;">
          <div class="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            ${escapeHtml(String(row["Nombre del Proyecto"] || ""))}
          </div>
          <div class="row"><div class="label">Segmento TRL:</div><div class="value">${escapeHtml(String(row["Segmento TRL"] || ""))}</div></div>
          <div class="row"><div class="label">Nivel TRL:</div><div class="value">${escapeHtml(String(row["Nivel TRL"] || ""))}</div></div>
          <div class="row"><div class="label">Docente Acompañante:</div><div class="value">${docenteText}</div></div>
          <div class="row"><div class="label">Nivel de Inglés:</div><div class="value">${escapeHtml(String(row["Nivel de Ingles"] || ""))}</div></div>
          <div class="row"><div class="label">Ubicación:</div><div class="value">${escapeHtml(String(row["Ubicacion"] || ""))}</div></div>
          <div class="row"><div class="label">Puntaje Total:</div><div class="value">${escapeHtml(String(row["Puntaje Total"] || ""))}</div></div>
        </div>

        <div class="section">
          <div class="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Resultados de Evaluación
          </div>
          ${[
            ["TRL 1-3 (Básico)", row["Puntaje TRL 1-3"], "trl1-3"],
            ["TRL 4-7 (Intermedio)", row["Puntaje TRL 4-7"], "trl4-7"],
            ["TRL 8-9 (Avanzado)", row["Puntaje TRL 8-9"], "trl8-9"],
          ]
            .map(([label, score, className]) => {
              const value = Number(score || 0);
              const status = value >= 50 ? "Competencia alcanzada" : "En desarrollo";
              return `<div class="row">
                <div class="label">${label}:</div>
                <div class="value">
                  <div class="progress-info">
                    <span>Puntaje: ${value}%</span>
                    <span>${status}</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill ${className}" style="width: ${value}%"></div>
                  </div>
                </div>
              </div>`;
            })
            .join("")}
          ${
            insights.length
              ? `<div class="row" style="margin-top: 1rem; align-items: flex-start;">
                  <div class="label" style="margin-top: 0.2rem;">Insights:</div>
                  <div class="value">
                    <ul style="list-style-type: disc; padding-left: 1.2rem; margin: 0;">
                      ${insights.map((item) => `<li style="margin-bottom: 0.4rem;">${escapeHtml(item)}</li>`).join("")}
                    </ul>
                  </div>
                </div>`
              : ""
          }
        </div>`;
      })
      .join("\n")}

    <div class="footer">
      Reporte generado automáticamente por el Sistema TRL - Universidad Continental
    </div>
    <div class="no-print" style="margin-top: 2rem; text-align: center">
      <button onclick="window.print()" style="padding: 0.6rem 1.5rem; background-color: var(--primary-color); color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500; transition: background-color 0.2s;">
        Imprimir Reporte
      </button>
    </div>
    <script>
      window.onload = function () {
        setTimeout(() => {
          window.print();
          window.onafterprint = function () { window.close(); };
        }, 500);
      };
    </script>
  </div>
</body>
</html>`;
}
async function getTrlData(force = false) {
  await ensureOverridesLoaded();
  if (!force && trlCache) return trlCache;
  const entries = await fetchGravityEntries();
  const rows = processEntries(entries);
  trlCache = { updatedAt: Date.now(), rows };
  return trlCache;
}

function getMetricasPrincipales(rows: TrlRow[]) {
  const trlMax = rows.length ? Math.max(...rows.map((r) => Number(r["Nivel TRL"] || 0))) : 0;
  const aprobados = rows.filter((r) => r.Aprobado === "Si").length;
  const docenteSi = rows.filter((r) => r["Docente Acompanante"]).length;
  const docenteNo = rows.length - docenteSi;
  const topProyectos: Record<string, string> = {};
  for (const segment of SEGMENTS) {
    const filtered = rows.filter((r) => r["Segmento TRL"] === segment);
    if (!filtered.length) continue;
    const top = filtered.reduce((best, row) => (Number(row["Puntaje Total"] || 0) > Number(best["Puntaje Total"] || 0) ? row : best));
    topProyectos[segment] = String(top["Nombre del Proyecto"] || "");
  }
  const nivelInglesCounts: Record<string, number> = {};
  for (const row of rows) {
    const nivel = row["Nivel de Ingles"] || "No especificado";
    nivelInglesCounts[nivel] = (nivelInglesCounts[nivel] || 0) + 1;
  }
  const nivelInglesMasComun = Object.entries(nivelInglesCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "No especificado";

  return {
    formularios: rows.length,
    trl_max: trlMax,
    aprobados,
    docente_si: docenteSi,
    docente_no: docenteNo,
    puntaje_maximo: rows.length ? Math.max(...rows.map((r) => Number(r["Puntaje Total"] || 0))) : 0,
    top_proyectos_trl: topProyectos,
    nivel_ingles_mas_comun: nivelInglesMasComun,
  };
}

function getInsightsGenerales(rows: TrlRow[]) {
  const total = rows.length;
  const aprobados = rows.filter((r) => r.Aprobado === "Si").length;
  const porcentaje = total > 0 ? Math.round((aprobados / total) * 1000) / 10 : 0;
  const distribucion: Record<string, number> = {};
  for (const row of rows) {
    const segment = row["Segmento TRL"] || "Desconocido";
    distribucion[segment] = (distribucion[segment] || 0) + 1;
  }
  const promedios = {
    "TRL 1-3": promedio(rows.map((r) => Number(r["Puntaje TRL 1-3"] || 0))),
    "TRL 4-7": promedio(rows.map((r) => Number(r["Puntaje TRL 4-7"] || 0))),
    "TRL 8-9": promedio(rows.map((r) => Number(r["Puntaje TRL 8-9"] || 0))),
    Total: promedio(rows.map((r) => Number(r["Puntaje Total"] || 0))),
  };
  const topRows = [...rows].sort((a, b) => Number(b["Puntaje Total"] || 0) - Number(a["Puntaje Total"] || 0)).slice(0, 3);
  const topProyectos = topRows.map((row) => ({
    "Nombre del Proyecto": String(row["Nombre del Proyecto"] || ""),
    "Puntaje Total": Math.round(Number(row["Puntaje Total"] || 0) * 10) / 10,
  }));
  const recomendacion = (distribucion["TRL 1-3"] || 0) > (distribucion["TRL 8-9"] || 0)
    ? "Mentoría a proyectos iniciales"
    : "Preparar implementación";
  const insights = [
    `${aprobados} de ${total} proyectos están aprobados (${porcentaje}%)`,
    topProyectos.length
      ? `Proyecto con mayor puntaje: ${topProyectos[0]["Nombre del Proyecto"]} (${topProyectos[0]["Puntaje Total"]} pts)`
      : "No hay proyectos destacados",
    `Distribución TRL: ${distribucion["TRL 1-3"] || 0} inicial, ${distribucion["TRL 4-7"] || 0} en desarrollo, ${distribucion["TRL 8-9"] || 0} listos`,
    `Promedios: TRL 1-3: ${promedios["TRL 1-3"]}, TRL 4-7: ${promedios["TRL 4-7"]}, TRL 8-9: ${promedios["TRL 8-9"]}`,
    `Recomendación: ${recomendacion}`,
  ];

  return {
    metricas: {
      total_proyectos: total,
      aprobados,
      porcentaje_aprobados: porcentaje,
      distribucion_trl: distribucion,
      promedios,
    },
    top_proyectos: topProyectos,
    insights,
  };
}

function promedio(values: number[]) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

function filterByName(rows: TrlRow[], term: string) {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  return rows.filter((row) => String(row["Nombre del Proyecto"] || "").toLowerCase().includes(needle));
}

export function attachTrlRoutes(app: Express) {
  app.post("/admin/trl/actualizar-datos", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    try {
      const data = await getTrlData(true);
      res.json({ mensaje: `Datos cargados (${data.rows.length} registros)` });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_update_failed" });
    }
  });

  app.get("/admin/trl/metricas-principales", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const year = Number(req.query.year || 0) || undefined;
    try {
      const data = await getTrlData();
      const filtered = applyTrlOverrides(filterRowsByYear(data.rows, year));
      res.json(getMetricasPrincipales(filtered));
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_metrics_failed" });
    }
  });

  app.get("/admin/trl/datos-graficos", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const year = Number(req.query.year || 0) || undefined;
    try {
      const data = await getTrlData();
      const filtered = applyTrlOverrides(filterRowsByYear(data.rows, year));
      res.json({ graficos: buildCharts(filtered) });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_charts_failed" });
    }
  });

  app.get("/admin/trl/proyectos", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const year = Number(req.query.year || 0) || undefined;
    try {
      const data = await getTrlData();
      const filtered = applyTrlOverrides(filterRowsByYear(data.rows, year));
      const overrides = loadOverrides();
      const projects = filtered.map((row) => {
        const nombre = String(row["Nombre del Proyecto"] || "");
        const rowYear = Number(row["Anio Registro"]) || undefined;
        const entryId = normalizeEntryId((row as any)?.id ?? (row as any)?.entry_id ?? (row as any)?.entryId);
        const emailStatus = findEmailStatusEntry(overrides.emailSends, nombre, rowYear);
        const sendCount = Number(emailStatus?.sendCount || emailStatus?.history?.length || 0);
        return {
          EntryId: entryId,
          "Nombre del Proyecto": row["Nombre del Proyecto"],
          Correo: row["Correo"] || "",
          Aprobado: row.Aprobado,
          AprobadoForzado: row.AprobadoForzado,
          "Nivel TRL": row["Nivel TRL"],
          "Puntaje TRL 1-3": row["Puntaje TRL 1-3"],
          "Puntaje TRL 4-7": row["Puntaje TRL 4-7"],
          "Puntaje TRL 8-9": row["Puntaje TRL 8-9"],
          "Puntaje Total": row["Puntaje Total"],
          "Segmento TRL": row["Segmento TRL"],
          Industria: row.Industria,
          Insights: row.Insights,
          "Docente Acompanante": row["Docente Acompanante"],
          "Nivel de Ingles": row["Nivel de Ingles"],
          Ubicacion: row.Ubicacion,
          CorreoEnviado: sendCount > 0,
          CorreoEnvios: sendCount,
          CorreoUltimoEnvio: emailStatus?.lastSentAt || null,
          CorreoUltimoEmail: emailStatus?.lastEmail || "",
        };
      });
      res.json({ proyectos: projects });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_projects_failed" });
    }
  });

  app.post("/admin/trl/enviar-correo", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const correo = String(req.body?.correo || "").trim();
    const proyecto = String(req.body?.proyecto || "").trim();
    const year = Number(req.body?.year || 0) || undefined;
    if (!correo || !proyecto) {
      res.status(400).json({ error: "correo_y_proyecto_requeridos" });
      return;
    }
    if (!TRL_N8N_WEBHOOK_URL) {
      res.status(500).json({ error: "n8n_webhook_no_configurado" });
      return;
    }
    try {
      const response = await fetch(TRL_N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, proyecto }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        res.status(502).json({ error: "webhook_failed", detail: text });
        return;
      }
      const status = await registerEmailSend(proyecto, correo, year);
      res.json({ ok: true, status });
    } catch (err: any) {
      console.error("Error enviando a n8n:", err);
      res.status(502).json({ error: "webhook_failed" });
    }
  });

  app.post("/admin/trl/forzar-aprobacion", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const nombre = String(req.body?.nombre || "").trim();
    const year = Number(req.body?.year || 0) || undefined;
    const forceRaw = req.body?.force;
    const force = forceRaw === false || String(forceRaw).toLowerCase() === "false" ? false : true;
    if (!nombre) {
      res.status(400).json({ error: "nombre_required" });
      return;
    }
    try {
      const data = await getTrlData();
      const filtered = filterRowsByYear(data.rows, year);
      const match = findRowByName(filtered, nombre);
      if (!match) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const overrides = loadOverrides();
      const key = buildOverrideKey(nombre, year);
      if (force) {
        overrides.forceApproved[key] = { name: nombre, year, setAt: new Date().toISOString() };
      } else {
        delete overrides.forceApproved[key];
      }
      await saveOverrides(overrides);
      res.json({ nombre, year, forced: force });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_force_failed" });
    }
  });

  app.post("/admin/trl/eliminar-proyecto", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const nombre = String(req.body?.nombre || "").trim();
    const year = Number(req.body?.year || 0) || undefined;
    if (!nombre) {
      res.status(400).json({ error: "nombre_required" });
      return;
    }
    try {
      const data = await getTrlData();
      const filtered = filterRowsByYear(data.rows, year);
      const match = findRowByName(filtered, nombre);
      if (!match) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const overrides = loadOverrides();
      const key = buildOverrideKey(nombre, year);
      overrides.deletedProjects[key] = { name: nombre, year, setAt: new Date().toISOString() };
      if (overrides.forceApproved[key]) delete overrides.forceApproved[key];
      await saveOverrides(overrides);
      res.json({ nombre, year, deleted: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_delete_failed" });
    }
  });

  app.get("/admin/trl/proyectos-eliminados", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const year = Number(req.query.year || 0) || undefined;
    try {
      await ensureOverridesLoaded();
      const proyectos = listDeletedProjects(year).map((item) => ({
        "Nombre del Proyecto": item.name,
        "Anio Registro": item.year || null,
        "Eliminado En": item.setAt || "",
      }));
      res.json({ proyectos });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_deleted_projects_failed" });
    }
  });

  app.post("/admin/trl/restablecer-proyecto", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const nombre = String(req.body?.nombre || "").trim();
    const year = Number(req.body?.year || 0) || undefined;
    if (!nombre) {
      res.status(400).json({ error: "nombre_required" });
      return;
    }
    try {
      await ensureOverridesLoaded();
      const overrides = loadOverrides();
      const scopedKey = buildOverrideKey(nombre, year);
      const fallbackKey = buildOverrideKey(nombre);
      let removed = 0;

      if (overrides.deletedProjects[scopedKey]) {
        delete overrides.deletedProjects[scopedKey];
        removed += 1;
      }
      if (overrides.deletedProjects[fallbackKey]) {
        delete overrides.deletedProjects[fallbackKey];
        removed += 1;
      }

      if (!removed) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      await saveOverrides(overrides);
      res.json({ nombre, year, restored: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_restore_failed" });
    }
  });

  app.post("/admin/trl/migrar-proyecto", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const nombre = String(req.body?.nombre || "").trim();
    const entryIdReq = normalizeEntryId(req.body?.entryId);
    const fromYear = Number(req.body?.fromYear || 0) || undefined;
    const toYear = Number(req.body?.toYear || 0) || undefined;
    if (!nombre && !entryIdReq) {
      res.status(400).json({ error: "nombre_o_entryid_required" });
      return;
    }
    if (!fromYear || !toYear || !Number.isFinite(fromYear) || !Number.isFinite(toYear)) {
      res.status(400).json({ error: "anios_invalidos" });
      return;
    }
    if (fromYear === toYear) {
      res.status(400).json({ error: "anios_iguales" });
      return;
    }
    try {
      const data = await getTrlData();
      const filtered = filterRowsByYear(data.rows, fromYear);
      const match = entryIdReq ? findRowByEntryId(filtered, entryIdReq) : findRowByName(filtered, nombre);
      if (!match) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const projectName = String(nombre || match["Nombre del Proyecto"] || "").trim();
      const originalYear = Number(match["Anio Registro Original"] || match["Anio Registro"]) || fromYear;
      const entryId = entryIdReq || normalizeEntryId((match as any)?.id ?? (match as any)?.entry_id ?? (match as any)?.entryId);
      const overrides = loadOverrides();
      const sourceKey = entryId ? `id::${entryId}` : buildOverrideKey(projectName, originalYear);
      const targetDeletedKey = buildOverrideKey(projectName, toYear);
      overrides.migratedProjects[sourceKey] = {
        name: projectName,
        fromYear: originalYear,
        toYear,
        entryId: entryId || undefined,
        setAt: new Date().toISOString(),
      };
      if (entryId) {
        const legacyKey = buildOverrideKey(projectName, originalYear);
        if (legacyKey !== sourceKey && overrides.migratedProjects[legacyKey]) {
          delete overrides.migratedProjects[legacyKey];
        }
      }
      // Si estuvo oculto en el año destino, lo limpiamos para que sea visible tras migrar.
      if (overrides.deletedProjects[targetDeletedKey]) {
        delete overrides.deletedProjects[targetDeletedKey];
      }
      await saveOverrides(overrides);
      res.json({ nombre: projectName, entryId: entryId || null, fromYear, toYear, migrated: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_migrate_failed" });
    }
  });

  app.post("/admin/trl/buscar-proyecto", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const year = Number(req.query.year || 0) || undefined;
    const nombre = String(req.body?.nombre || "");
    try {
      const data = await getTrlData();
      const filtered = applyTrlOverrides(filterRowsByYear(data.rows, year));
      const results = filterByName(filtered, nombre);
      if (!results.length) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ proyectos: results });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_search_failed" });
    }
  });

  app.get("/admin/trl/insights-generales", async (req, res) => {
    if (!requireTrlAuth(req, res)) return;
    const year = Number(req.query.year || 0) || undefined;
    try {
      const data = await getTrlData();
      const filtered = applyTrlOverrides(filterRowsByYear(data.rows, year));
      res.json(getInsightsGenerales(filtered));
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "trl_insights_failed" });
    }
  });

  app.get("/admin/trl/reporte-proyecto/:nombre", async (req, res) => {
    if (!requireAuthQuery(String(req.query.auth || ""))) {
      res.status(401).send("Credenciales invalidas");
      return;
    }
    const year = Number(req.query.year || 0) || undefined;
    try {
      const data = await getTrlData();
      const filtered = applyTrlOverrides(filterRowsByYear(data.rows, year));
      const nombre = decodeURIComponent(req.params.nombre || "");
      const project = findRowByName(filtered, nombre) || filterByName(filtered, nombre)[0];
      if (!project) {
        res.status(404).send("Proyecto no encontrado");
        return;
      }
      const html = renderReportHtmlProject(project, new Date().toLocaleString());
      res.type("text/html").send(html);
    } catch (err: any) {
      console.error(err);
      res.status(500).send(err.message || "Error al generar reporte");
    }
  });

  app.get("/admin/trl/reporte-top10", async (req, res) => {
    if (!requireAuthQuery(String(req.query.auth || ""))) {
      res.status(401).send("Credenciales invalidas");
      return;
    }
    const year = Number(req.query.year || 0) || undefined;
    try {
      const data = await getTrlData();
      const filtered = applyTrlOverrides(filterRowsByYear(data.rows, year));
      const top10 = [...filtered]
        .sort((a, b) => Number(b["Puntaje Total"] || 0) - Number(a["Puntaje Total"] || 0))
        .slice(0, 10);
      const html = renderReportListHtml(top10, "Top 10 Proyectos con Mayor Puntaje", new Date().toLocaleString());
      res.type("text/html").send(html);
    } catch (err: any) {
      console.error(err);
      res.status(500).send(err.message || "Error al generar reporte");
    }
  });

  app.get("/admin/trl/reporte-aprobados", async (req, res) => {
    if (!requireAuthQuery(String(req.query.auth || ""))) {
      res.status(401).send("Credenciales invalidas");
      return;
    }
    const year = Number(req.query.year || 0) || undefined;
    try {
      const data = await getTrlData();
      const filtered = applyTrlOverrides(filterRowsByYear(data.rows, year));
      const aprobados = filtered.filter((row) => row.Aprobado === "Si");
      const csv = toCsv(aprobados);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=proyectos_aprobados.csv");
      res.send(csv);
    } catch (err: any) {
      console.error(err);
      res.status(500).send(err.message || "Error al generar reporte");
    }
  });
}
