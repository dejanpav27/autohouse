const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

let db = null;

async function initDB() {
  const dbPath = process.env.DB_PATH || "./data/autohouse.db";
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS dealers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      logo TEXT DEFAULT '',
      logo_image TEXT DEFAULT '',
      accent TEXT DEFAULT '#c8ff00',
      accent_secondary TEXT DEFAULT '#ff6b6b',
      bg_image TEXT DEFAULT '',
      bg_overlay_opacity REAL DEFAULT 0.7,
      avatar_name TEXT DEFAULT '',
      avatar_image TEXT DEFAULT '',
      chat_header_image TEXT DEFAULT '',
      welcome_headline TEXT DEFAULT 'Dream Machine?',
      welcome_subline TEXT DEFAULT 'Hello, ready to find your',
      tagline TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      languages TEXT DEFAULT '["en"]',
      locations TEXT DEFAULT '[]',
      chat_webhook TEXT DEFAULT '',
      tts_api_key TEXT DEFAULT '',
      tts_voice_id TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cars (
      id TEXT PRIMARY KEY,
      dealer_id TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      trim_level TEXT DEFAULT '',
      year INTEGER DEFAULT 0,
      price REAL DEFAULT 0,
      mileage INTEGER DEFAULT 0,
      fuel TEXT DEFAULT 'gasoline',
      transmission TEXT DEFAULT 'manual',
      drivetrain TEXT DEFAULT 'FWD',
      body_type TEXT DEFAULT 'Sedan',
      condition TEXT DEFAULT 'used',
      status TEXT DEFAULT 'available',
      engine_cc INTEGER DEFAULT 0,
      hp INTEGER DEFAULT 0,
      color TEXT DEFAULT '',
      media TEXT DEFAULT '[]',
      features TEXT DEFAULT '[]',
      description TEXT DEFAULT '',
      vin TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (dealer_id) REFERENCES dealers(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'dealer',
      dealer_id TEXT,
      name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (dealer_id) REFERENCES dealers(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS test_drives (
      id TEXT PRIMARY KEY,
      dealer_id TEXT NOT NULL,
      car_id TEXT NOT NULL,
      customer_email TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      location TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (dealer_id) REFERENCES dealers(id),
      FOREIGN KEY (car_id) REFERENCES cars(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      dealer_id TEXT NOT NULL,
      session_data TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (dealer_id) REFERENCES dealers(id)
    )
  `);

  // Indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_cars_dealer ON cars(dealer_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status)");
  db.run("CREATE INDEX IF NOT EXISTS idx_cars_make ON cars(make)");
  db.run("CREATE INDEX IF NOT EXISTS idx_dealers_slug ON dealers(slug)");
  db.run("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");

  saveDB();
  console.log("✅ Database initialized");
  return db;
}

function saveDB() {
  const dbPath = process.env.DB_PATH || "./data/autohouse.db";
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDB() {
  return db;
}

// Auto-save every 30 seconds
setInterval(() => {
  if (db) saveDB();
}, 30000);

module.exports = { initDB, getDB, saveDB };
