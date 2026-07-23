const express = require("express");
const { v4: uuid } = require("uuid");
const { getDB, saveDB } = require("../database");
const { rowToJSON, jsonToRow } = require("../helpers");

const router = express.Router();

const DEALER_FIELDS = [
  "name","slug","logo","logo_image","accent","accent_secondary",
  "bg_image","bg_overlay_opacity","avatar_name","avatar_image",
  "chat_header_image","welcome_headline","welcome_subline",
  "tagline","phone","email","address","languages","locations",
  "chat_webhook","tts_api_key","tts_voice_id","status"
];

// GET /api/dealers - list all
router.get("/", (req, res) => {
  const db = getDB();
  const stmt = db.prepare("SELECT * FROM dealers ORDER BY created_at DESC");
  const rows = [];
  while (stmt.step()) rows.push(rowToJSON(stmt.getAsObject()));
  stmt.free();

  // Attach car counts
  const countStmt = db.prepare("SELECT dealer_id, COUNT(*) as cnt FROM cars GROUP BY dealer_id");
  const counts = {};
  while (countStmt.step()) {
    const r = countStmt.getAsObject();
    counts[r.dealer_id] = r.cnt;
  }
  countStmt.free();

  rows.forEach(d => d.carsCount = counts[d.id] || 0);
  res.json(rows);
});

// GET /api/dealers/:id
router.get("/:id", (req, res) => {
  const db = getDB();
  const stmt = db.prepare("SELECT * FROM dealers WHERE id = ?");
  stmt.bind([req.params.id]);
  if (!stmt.step()) { stmt.free(); return res.status(404).json({ error: "Dealer not found" }); }
  const dealer = rowToJSON(stmt.getAsObject());
  stmt.free();
  res.json(dealer);
});

// GET /api/dealers/slug/:slug - public facing
router.get("/slug/:slug", (req, res) => {
  const db = getDB();
  const stmt = db.prepare("SELECT * FROM dealers WHERE slug = ? AND status = 'active'");
  stmt.bind([req.params.slug]);
  if (!stmt.step()) { stmt.free(); return res.status(404).json({ error: "Dealer not found" }); }
  const dealer = rowToJSON(stmt.getAsObject());
  stmt.free();
  // Don't expose sensitive fields
  delete dealer.ttsApiKey;
  delete dealer.chatWebhook;
  res.json(dealer);
});

// POST /api/dealers
router.post("/", (req, res) => {
  const db = getDB();
  const id = uuid();
  const data = jsonToRow(req.body, DEALER_FIELDS);
  
  if (!data.name || !data.slug) {
    return res.status(400).json({ error: "name and slug are required" });
  }

  const cols = ["id", ...Object.keys(data)];
  const placeholders = cols.map(() => "?").join(",");
  const vals = [id, ...Object.values(data)];

  try {
    db.run(`INSERT INTO dealers (${cols.join(",")}) VALUES (${placeholders})`, vals);
    saveDB();
    res.status(201).json({ id, ...req.body });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/dealers/:id
router.put("/:id", (req, res) => {
  const db = getDB();
  const data = jsonToRow(req.body, DEALER_FIELDS);
  
  const sets = Object.keys(data).map(k => `${k} = ?`).join(", ");
  const vals = [...Object.values(data), req.params.id];

  try {
    db.run(`UPDATE dealers SET ${sets}, updated_at = datetime('now') WHERE id = ?`, vals);
    saveDB();
    res.json({ id: req.params.id, ...req.body });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/dealers/:id
router.delete("/:id", (req, res) => {
  const db = getDB();
  db.run("DELETE FROM dealers WHERE id = ?", [req.params.id]);
  saveDB();
  res.json({ deleted: true });
});

module.exports = router;
