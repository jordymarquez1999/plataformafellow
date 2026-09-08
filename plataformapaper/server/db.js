import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const defaultPath = join(process.cwd(), "data", "papers.db");
const dbPath = process.env.DB_PATH || defaultPath;

export async function initDb() {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      members INTEGER NOT NULL,
      campus TEXT NOT NULL,
      ods TEXT NOT NULL,
      line TEXT NOT NULL,
      journal_country TEXT NOT NULL,
      status TEXT NOT NULL,
      journal_url TEXT,
      pay_status TEXT NOT NULL,
      pay_proof_url TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await seedIfEmpty(db);
  return db;
}

export function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    members: row.members,
    campus: row.campus,
    ods: row.ods,
    line: row.line,
    journalCountry: row.journal_country,
    status: row.status,
    journalUrl: row.journal_url || "",
    payStatus: row.pay_status,
    payProofUrl: row.pay_proof_url || "",
    createdAt: row.created_at,
  };
}

async function seedIfEmpty(db) {
  const row = await db.get("SELECT COUNT(*) as count FROM papers");
  if (row && row.count > 0) return;

  const seeds = [
    {
      id: "pp-001",
      title: "Detección temprana de erosión en suelos agrícolas",
      members: 4,
      campus: "Sede Norte",
      ods: "ODS 2",
      line: "Agrotecnologia",
      journalCountry: "Mexico",
      status: "En proceso",
      journalUrl: "https://revistas.example.com/soil-erosion",
      payStatus: "Pendiente",
      payProofUrl: "",
      createdAt: "2025-10-05T10:20:00.000Z",
    },
    {
      id: "pp-002",
      title: "Análisis de datos abiertos para movilidad urbana",
      members: 3,
      campus: "Sede Centro",
      ods: "ODS 11",
      line: "Data Science",
      journalCountry: "Colombia",
      status: "Finalizado",
      journalUrl: "https://revistas.example.com/urban-mobility",
      payStatus: "Pagado",
      payProofUrl: "https://drive.google.com/example-proof-1",
      createdAt: "2025-08-19T14:05:00.000Z",
    },
    {
      id: "pp-003",
      title: "Impacto de IA generativa en educación superior",
      members: 5,
      campus: "Sede Sur",
      ods: "ODS 4",
      line: "EdTech",
      journalCountry: "Chile",
      status: "En proceso",
      journalUrl: "https://revistas.example.com/ai-edu",
      payStatus: "Pagado",
      payProofUrl: "https://drive.google.com/example-proof-2",
      createdAt: "2025-09-02T09:45:00.000Z",
    },
  ];

  const stmt = await db.prepare(
    `INSERT INTO papers (
      id, title, members, campus, ods, line, journal_country, status,
      journal_url, pay_status, pay_proof_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  try {
    for (const seed of seeds) {
      await stmt.run([
        seed.id,
        seed.title,
        seed.members,
        seed.campus,
        seed.ods,
        seed.line,
        seed.journalCountry,
        seed.status,
        seed.journalUrl,
        seed.payStatus,
        seed.payProofUrl,
        seed.createdAt,
      ]);
    }
  } finally {
    await stmt.finalize();
  }
}
