const express = require("express");
const { v4: uuid } = require("uuid");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const { getDB, saveDB } = require("../database");
const { rowToJSON, jsonToRow } = require("../helpers");

const router = express.Router();
const upload = multer({ dest: process.env.UPLOAD_DIR || "./uploads" });

const CAR_FIELDS = [
  "dealer_id","make","model","trim_level","year","price","mileage",
  "fuel","transmission","drivetrain","body_type","condition","status",
  "engine_cc","hp","color","media","features","description","vin"
];

// GET /api/cars - list with filters
router.get("/", (req, res) => {
  const db = getDB();
  const { dealerId, status, make, minPrice, maxPrice, fuel, transmission, bodyType, search, limit, offset } = req.query;
  
  let where = ["1=1"];
  let params = [];

  if (dealerId) { where.push("dealer_id = ?"); params.push(dealerId); }
  if (status) { where.push("status = ?"); params.push(status); }
  if (make) { where.push("make = ?"); params.push(make); }
  if (fuel) { where.push("fuel = ?"); params.push(fuel); }
  if (transmission) { where.push("transmission = ?"); params.push(transmission); }
  if (bodyType) { where.push("body_type = ?"); params.push(bodyType); }
  if (minPrice) { where.push("price >= ?"); params.push(parseFloat(minPrice)); }
  if (maxPrice) { where.push("price <= ?"); params.push(parseFloat(maxPrice)); }
  if (search) { where.push("(make LIKE ? OR model LIKE ? OR trim_level LIKE ?)"); const s = `%${search}%`; params.push(s,s,s); }

  const lim = Math.min(parseInt(limit) || 50, 200);
  const off = parseInt(offset) || 0;

  const sql = `SELECT * FROM cars WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(lim, off);

  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(rowToJSON(stmt.getAsObject()));
  stmt.free();

  // Total count
  const countSql = `SELECT COUNT(*) as total FROM cars WHERE ${where.join(" AND ")}`;
  const countStmt = db.prepare(countSql);
  countStmt.bind(params.slice(0, -2)); // without limit/offset
  countStmt.step();
  const total = countStmt.getAsObject().total;
  countStmt.free();

  res.json({ cars: rows, total, limit: lim, offset: off });
});

// GET /api/cars/:id
router.get("/:id", (req, res) => {
  const db = getDB();
  const stmt = db.prepare("SELECT * FROM cars WHERE id = ?");
  stmt.bind([req.params.id]);
  if (!stmt.step()) { stmt.free(); return res.status(404).json({ error: "Car not found" }); }
  const car = rowToJSON(stmt.getAsObject());
  stmt.free();
  res.json(car);
});

// POST /api/cars
router.post("/", (req, res) => {
  const db = getDB();
  const id = req.body.id || uuid();
  const data = jsonToRow(req.body, CAR_FIELDS);

  if (!data.dealer_id || !data.make || !data.model) {
    return res.status(400).json({ error: "dealer_id, make, and model are required" });
  }

  const cols = ["id", ...Object.keys(data)];
  const placeholders = cols.map(() => "?").join(",");
  const vals = [id, ...Object.values(data)];

  try {
    db.run(`INSERT INTO dealers (id) VALUES (?) ON CONFLICT DO NOTHING`, [data.dealer_id]);
    db.run(`INSERT INTO cars (${cols.join(",")}) VALUES (${placeholders})`, vals);
    saveDB();
    res.status(201).json({ id, ...req.body });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/cars/:id
router.put("/:id", (req, res) => {
  const db = getDB();
  const data = jsonToRow(req.body, CAR_FIELDS);

  const sets = Object.keys(data).map(k => `${k} = ?`).join(", ");
  const vals = [...Object.values(data), req.params.id];

  try {
    db.run(`UPDATE cars SET ${sets}, updated_at = datetime('now') WHERE id = ?`, vals);
    saveDB();
    res.json({ id: req.params.id, ...req.body });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/cars/:id
router.delete("/:id", (req, res) => {
  const db = getDB();
  db.run("DELETE FROM cars WHERE id = ?", [req.params.id]);
  saveDB();
  res.json({ deleted: true });
});

// POST /api/cars/batch - bulk create
router.post("/batch", (req, res) => {
  const db = getDB();
  const { cars } = req.body;
  if (!Array.isArray(cars)) return res.status(400).json({ error: "cars array required" });

  let inserted = 0, errors = [];

  for (const car of cars) {
    try {
      const id = car.id || uuid();
      const data = jsonToRow(car, CAR_FIELDS);
      if (!data.dealer_id || !data.make || !data.model) {
        errors.push({ car: `${car.make} ${car.model}`, error: "missing required fields" });
        continue;
      }
      const cols = ["id", ...Object.keys(data)];
      const placeholders = cols.map(() => "?").join(",");
      db.run(`INSERT INTO cars (${cols.join(",")}) VALUES (${placeholders})`, [id, ...Object.values(data)]);
      inserted++;
    } catch (e) {
      errors.push({ car: `${car.make} ${car.model}`, error: e.message });
    }
  }

  saveDB();
  res.json({ inserted, errors, total: cars.length });
});

// POST /api/cars/import-csv - CSV file import
router.post("/import-csv", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const dealerId = req.body.dealerId || req.query.dealerId;
  if (!dealerId) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "dealerId required" });
  }

  const db = getDB();
  const rows = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("end", () => {
      fs.unlinkSync(req.file.path); // cleanup

      let inserted = 0, errors = [];

      // Column mapping: flexible header names
      const MAP = {
        make: ["make", "marka", "brand", "hersteller"],
        model: ["model", "modell"],
        trim_level: ["trim", "trim_level", "ausstattung", "oprema"],
        year: ["year", "godina", "jahr", "baujahr"],
        price: ["price", "cena", "preis", "cijena"],
        mileage: ["mileage", "km", "kilometraza", "kilometerstand"],
        fuel: ["fuel", "gorivo", "kraftstoff", "fuel_type"],
        transmission: ["transmission", "menjac", "getriebe"],
        drivetrain: ["drivetrain", "pogon", "antrieb"],
        body_type: ["body_type", "bodytype", "karoserija", "typ"],
        condition: ["condition", "stanje", "zustand"],
        engine_cc: ["engine_cc", "kubikaza", "hubraum", "cc"],
        hp: ["hp", "ks", "ps", "horsepower", "snaga"],
        color: ["color", "boja", "farbe"],
        vin: ["vin"],
        description: ["description", "opis", "beschreibung"],
        status: ["status"],
      };

      function findCol(row, aliases) {
        for (const a of aliases) {
          const key = Object.keys(row).find(k => k.toLowerCase().trim() === a);
          if (key && row[key]) return row[key].trim();
        }
        return "";
      }

      for (const row of rows) {
        try {
          const car = {
            dealer_id: dealerId,
            make: findCol(row, MAP.make),
            model: findCol(row, MAP.model),
            trim_level: findCol(row, MAP.trim_level),
            year: parseInt(findCol(row, MAP.year)) || 0,
            price: parseFloat(findCol(row, MAP.price).replace(/[^0-9.]/g, "")) || 0,
            mileage: parseInt(findCol(row, MAP.mileage).replace(/[^0-9]/g, "")) || 0,
            fuel: findCol(row, MAP.fuel) || "gasoline",
            transmission: findCol(row, MAP.transmission) || "manual",
            drivetrain: findCol(row, MAP.drivetrain) || "FWD",
            body_type: findCol(row, MAP.body_type) || "Sedan",
            condition: findCol(row, MAP.condition) || "used",
            engine_cc: parseInt(findCol(row, MAP.engine_cc)) || 0,
            hp: parseInt(findCol(row, MAP.hp)) || 0,
            color: findCol(row, MAP.color),
            vin: findCol(row, MAP.vin),
            description: findCol(row, MAP.description),
            status: findCol(row, MAP.status) || "available",
            media: "[]",
            features: "[]",
          };

          if (!car.make || !car.model) {
            errors.push({ row: rows.indexOf(row) + 1, error: "Missing make/model" });
            continue;
          }

          // Handle image columns if present
          const imgCols = Object.keys(row).filter(k => /image|slika|bild|photo|foto|media/i.test(k));
          if (imgCols.length > 0) {
            const media = imgCols
              .map(k => row[k]?.trim())
              .filter(Boolean)
              .map(url => {
                if (/youtube|vimeo|\.mp4|\.webm/i.test(url)) return { type: "video", url };
                return { type: "image", url };
              });
            car.media = JSON.stringify(media);
          }

          // Handle features column
          const featCol = Object.keys(row).find(k => /feature|oprema|ausstattung|equipment/i.test(k.toLowerCase()));
          if (featCol && row[featCol]) {
            car.features = JSON.stringify(row[featCol].split(/[,;|]/).map(s => s.trim()).filter(Boolean));
          }

          const id = uuid();
          const cols = ["id", ...Object.keys(car)];
          const placeholders = cols.map(() => "?").join(",");
          db.run(`INSERT INTO cars (${cols.join(",")}) VALUES (${placeholders})`, [id, ...Object.values(car)]);
          inserted++;
        } catch (e) {
          errors.push({ row: rows.indexOf(row) + 1, error: e.message });
        }
      }

      saveDB();
      res.json({ inserted, errors, totalRows: rows.length });
    })
    .on("error", (err) => {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ error: err.message });
    });
});

// GET /api/cars/stats/overview
router.get("/stats/overview", (req, res) => {
  const db = getDB();
  const { dealerId } = req.query;
  let where = dealerId ? "WHERE dealer_id = ?" : "";
  let params = dealerId ? [dealerId] : [];

  const total = db.prepare(`SELECT COUNT(*) as c FROM cars ${where}`);
  if (params.length) total.bind(params);
  total.step();
  const totalCount = total.getAsObject().c;
  total.free();

  const available = db.prepare(`SELECT COUNT(*) as c FROM cars ${where ? where + " AND" : "WHERE"} status = 'available'`);
  if (params.length) available.bind(params);
  available.step();
  const availCount = available.getAsObject().c;
  available.free();

  const value = db.prepare(`SELECT COALESCE(SUM(price),0) as v FROM cars ${where}`);
  if (params.length) value.bind(params);
  value.step();
  const totalValue = value.getAsObject().v;
  value.free();

  const makes = db.prepare(`SELECT make, COUNT(*) as c FROM cars ${where} GROUP BY make ORDER BY c DESC LIMIT 10`);
  if (params.length) makes.bind(params);
  const makesList = [];
  while (makes.step()) makesList.push(makes.getAsObject());
  makes.free();

  res.json({ totalCars: totalCount, available: availCount, totalValue, topMakes: makesList });
});

module.exports = router;
