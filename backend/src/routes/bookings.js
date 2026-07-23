const express = require("express");
const { v4: uuid } = require("uuid");
const { getDB, saveDB } = require("../database");
const { rowToJSON } = require("../helpers");

const router = express.Router();

// POST /api/bookings - create test drive request
router.post("/", (req, res) => {
  const { dealerId, carId, customerEmail, customerPhone, location, notes } = req.body;
  if (!dealerId || !carId) return res.status(400).json({ error: "dealerId and carId required" });

  const db = getDB();
  const id = uuid();
  db.run(
    "INSERT INTO test_drives (id, dealer_id, car_id, customer_email, customer_phone, location, notes) VALUES (?,?,?,?,?,?,?)",
    [id, dealerId, carId, customerEmail||"", customerPhone||"", location||"", notes||""]
  );
  saveDB();
  res.status(201).json({ id, status: "pending" });
});

// GET /api/bookings?dealerId=xxx
router.get("/", (req, res) => {
  const db = getDB();
  const { dealerId } = req.query;
  let sql = `SELECT t.*, c.make, c.model, c.trim_level FROM test_drives t 
             LEFT JOIN cars c ON t.car_id = c.id`;
  let params = [];
  if (dealerId) { sql += " WHERE t.dealer_id = ?"; params.push(dealerId); }
  sql += " ORDER BY t.created_at DESC";

  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(rowToJSON(stmt.getAsObject()));
  stmt.free();
  res.json(rows);
});

// PUT /api/bookings/:id
router.put("/:id", (req, res) => {
  const db = getDB();
  const { status, notes } = req.body;
  db.run("UPDATE test_drives SET status = ?, notes = ? WHERE id = ?", [status||"pending", notes||"", req.params.id]);
  saveDB();
  res.json({ updated: true });
});

module.exports = router;
