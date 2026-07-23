const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const { getDB, saveDB } = require("../database");
const { rowToJSON } = require("../helpers");

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "autohouse-secret";

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, name, dealerId, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const db = getDB();
  const hash = await bcrypt.hash(password, 10);
  const id = uuid();

  try {
    db.run(
      "INSERT INTO users (id, email, password_hash, name, dealer_id, role) VALUES (?,?,?,?,?,?)",
      [id, email, hash, name || "", dealerId || null, role || "dealer"]
    );
    saveDB();

    const token = jwt.sign({ userId: id, role: role || "dealer", dealerId }, SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id, email, name, role: role || "dealer", dealerId } });
  } catch (e) {
    res.status(400).json({ error: "Email already exists" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const db = getDB();
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  stmt.bind([email]);
  if (!stmt.step()) { stmt.free(); return res.status(401).json({ error: "Invalid credentials" }); }
  const user = stmt.getAsObject();
  stmt.free();

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ userId: user.id, role: user.role, dealerId: user.dealer_id }, SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, dealerId: user.dealer_id } });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(auth.replace("Bearer ", ""), SECRET);
    const db = getDB();
    const stmt = db.prepare("SELECT id, email, name, role, dealer_id FROM users WHERE id = ?");
    stmt.bind([decoded.userId]);
    if (!stmt.step()) { stmt.free(); return res.status(404).json({ error: "User not found" }); }
    const user = rowToJSON(stmt.getAsObject());
    stmt.free();
    res.json(user);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Middleware for auth
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Authentication required" });

  try {
    const decoded = jwt.verify(auth.replace("Bearer ", ""), SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

module.exports = { router, authMiddleware, adminOnly };
