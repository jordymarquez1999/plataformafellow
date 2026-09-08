import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { initDb, mapRow } from "./db.js";

const app = express();
const db = await initDb();
const port = Number(process.env.PORT || 8080);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/papers", async (_req, res) => {
  const rows = await db.all("SELECT * FROM papers ORDER BY created_at DESC");
  res.json(rows.map(mapRow));
});

app.post("/api/papers", async (req, res) => {
  const payload = req.body || {};
  if (!payload.title || !payload.campus || !payload.ods || !payload.line) {
    res.status(400).json({ error: "Missing required fields." });
    return;
  }
  const createdAt = new Date().toISOString();
  await db.run(
    `INSERT INTO papers (
      id, title, members, campus, ods, line, journal_country, status,
      journal_url, pay_status, pay_proof_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.id,
      payload.title,
      payload.members,
      payload.campus,
      payload.ods,
      payload.line,
      payload.journalCountry,
      payload.status,
      payload.journalUrl || "",
      payload.payStatus,
      payload.payProofUrl || "",
      createdAt,
    ]
  );

  const row = await db.get("SELECT * FROM papers WHERE id = ?", payload.id);
  res.status(201).json(mapRow(row));
});

app.put("/api/papers/:id", async (req, res) => {
  const payload = req.body || {};
  const id = req.params.id;
  const row = await db.get("SELECT * FROM papers WHERE id = ?", id);
  if (!row) {
    res.status(404).json({ error: "Paper not found." });
    return;
  }

  await db.run(
    `UPDATE papers SET
      title = ?, members = ?, campus = ?, ods = ?, line = ?,
      journal_country = ?, status = ?, journal_url = ?, pay_status = ?,
      pay_proof_url = ?
    WHERE id = ?`,
    [
      payload.title,
      payload.members,
      payload.campus,
      payload.ods,
      payload.line,
      payload.journalCountry,
      payload.status,
      payload.journalUrl || "",
      payload.payStatus,
      payload.payProofUrl || "",
      id,
    ]
  );

  const updated = await db.get("SELECT * FROM papers WHERE id = ?", id);
  res.json(mapRow(updated));
});

app.delete("/api/papers/:id", async (req, res) => {
  const id = req.params.id;
  await db.run("DELETE FROM papers WHERE id = ?", id);
  res.json({ ok: true });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "..", "dist");

app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
