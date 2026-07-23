require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { initDB } = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(process.env.UPLOAD_DIR || "./uploads"));

// Ensure upload dir exists
const uploadDir = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Routes
const dealerRoutes = require("./routes/dealers");
const carRoutes = require("./routes/cars");
const { router: authRoutes } = require("./routes/auth");
const bookingRoutes = require("./routes/bookings");

app.use("/api/dealers", dealerRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

// Start
(async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║     🚗  AutoHouse API Server  🚗        ║
║     Running on port ${PORT}                ║
╠══════════════════════════════════════════╣
║  Endpoints:                              ║
║  GET    /api/health                      ║
║  GET    /api/dealers                     ║
║  POST   /api/dealers                     ║
║  GET    /api/dealers/:id                 ║
║  GET    /api/dealers/slug/:slug          ║
║  PUT    /api/dealers/:id                 ║
║  DELETE /api/dealers/:id                 ║
║  GET    /api/cars                        ║
║  POST   /api/cars                        ║
║  POST   /api/cars/batch                  ║
║  POST   /api/cars/import-csv             ║
║  GET    /api/cars/stats/overview         ║
║  GET    /api/cars/:id                    ║
║  PUT    /api/cars/:id                    ║
║  DELETE /api/cars/:id                    ║
║  POST   /api/auth/register              ║
║  POST   /api/auth/login                 ║
║  GET    /api/auth/me                     ║
║  POST   /api/bookings                    ║
║  GET    /api/bookings                    ║
║  PUT    /api/bookings/:id                ║
╚══════════════════════════════════════════╝
    `);
  });
})();
