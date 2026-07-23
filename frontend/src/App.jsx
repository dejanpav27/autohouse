import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════
// AUTOHOUSE SaaS PLATFORM
// Multi-tenant car dealership management system
// ═══════════════════════════════════════════════════

// ── Image with gradient fallback ──
function Img({ src, alt="", style={}, fallbackText="", fallbackColor="#c8ff00", ...props }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div style={{...style, background:`linear-gradient(135deg, ${fallbackColor}15, ${fallbackColor}05, #111)`, display:"flex", alignItems:"center", justifyContent:"center"}}>
        {fallbackText && <span style={{fontSize:12, color:"#555", fontWeight:500}}>{fallbackText}</span>}
      </div>
    );
  }
  return <img src={src} alt={alt} style={style} onError={() => setFailed(true)} {...props} />;
}

// ── API Configuration ──
// Change this to your backend URL when deployed
// Change VITE_API_URL in your .env or Vercel environment variables
const API_URL = import.meta.env?.VITE_API_URL || window.AUTOHOUSE_API_URL || "/api";

// ── Storage (in-memory + localStorage with fallback) ──
const _memStore = {};
const SafeStore = {
  get(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch(e) { return _memStore[key] || null; } },
  set(key, val) { _memStore[key] = val; try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} },
  remove(key) { delete _memStore[key]; try { localStorage.removeItem(key); } catch(e) {} },
};

// ── API Service ──
const API = {
  token: null,

  async _fetch(path, opts = {}) {
    const headers = { "Content-Type": "application/json", ...opts.headers };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    try {
      const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
      if (res.status === 401) { SafeStore.remove("autohouse-session"); this.token = null; }
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      return await res.json();
    } catch (e) {
      console.warn(`API ${path} failed:`, e.message);
      throw e;
    }
  },

  // Dealers
  async getDealers() { return this._fetch("/dealers"); },
  async getDealer(id) { return this._fetch(`/dealers/${id}`); },
  async getDealerBySlug(slug) { return this._fetch(`/dealers/slug/${slug}`); },
  async createDealer(data) { return this._fetch("/dealers", { method: "POST", body: JSON.stringify(data) }); },
  async updateDealer(id, data) { return this._fetch(`/dealers/${id}`, { method: "PUT", body: JSON.stringify(data) }); },
  async deleteDealer(id) { return this._fetch(`/dealers/${id}`, { method: "DELETE" }); },

  // Cars
  async getCars(params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
    return this._fetch(`/cars${qs ? "?" + qs : ""}`);
  },
  async getCar(id) { return this._fetch(`/cars/${id}`); },
  async createCar(data) { return this._fetch("/cars", { method: "POST", body: JSON.stringify(data) }); },
  async updateCar(id, data) { return this._fetch(`/cars/${id}`, { method: "PUT", body: JSON.stringify(data) }); },
  async deleteCar(id) { return this._fetch(`/cars/${id}`, { method: "DELETE" }); },
  async batchCreateCars(cars) { return this._fetch("/cars/batch", { method: "POST", body: JSON.stringify({ cars }) }); },
  async getCarStats(dealerId) { return this._fetch(`/cars/stats/overview${dealerId ? "?dealerId=" + dealerId : ""}`); },

  // Auth
  async login(email, password) { return this._fetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); },
  async register(data) { return this._fetch("/auth/register", { method: "POST", body: JSON.stringify(data) }); },
  async getMe() { return this._fetch("/auth/me"); },

  // Bookings
  async createBooking(data) { return this._fetch("/bookings", { method: "POST", body: JSON.stringify(data) }); },
  async getBookings(dealerId) { return this._fetch(`/bookings${dealerId ? "?dealerId=" + dealerId : ""}`); },

  // CSV Import (multipart)
  async importCSV(file, dealerId) {
    const form = new FormData();
    form.append("file", file);
    form.append("dealerId", dealerId);
    const headers = {};
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    const res = await fetch(`${API_URL}/cars/import-csv`, { method: "POST", headers, body: form });
    return res.json();
  },
};

// ── Fallback: use local storage if API is unreachable ──
// This lets the app work standalone (demo) or with a backend
const DB = {
  async get(key) { try { const r = await window.storage?.get(key); return r ? JSON.parse(r.value) : SafeStore.get(key); } catch(e) { return SafeStore.get(key); } },
  async set(key, val) { try { await window.storage?.set(key, JSON.stringify(val)); } catch(e) {} SafeStore.set(key, val); },
  async delete(key) { try { await window.storage?.delete(key); } catch(e) {} SafeStore.remove(key); },
};

// Track whether backend is available
let API_AVAILABLE = false;
async function checkAPI() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const r = await fetch(`${API_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    API_AVAILABLE = r.ok;
  } catch(e) { API_AVAILABLE = false; }
  return API_AVAILABLE;
}

// ── Default Data ──
const DEFAULT_DEALERS = [
  {
    id: "ag-motors",
    name: "AG Motors",
    slug: "ag-motors",
    logo: "AG",
    logoImage: "",
    accent: "#c8ff00",
    accentSecondary: "#ff6b6b",
    bgImage: "https://picsum.photos/seed/dealership/1600/900",
    bgOverlayOpacity: 0.7,
    avatarName: "Marco",
    avatarImage: "https://picsum.photos/seed/avatar1/400/400",
    chatHeaderImage: "",
    welcomeHeadline: "Dream Machine",
    welcomeSubline: "Hello, ready to find your",
    tagline: "Sales | Service | Trust",
    phone: "+43 1 234 5678",
    email: "info@ag-motors.at",
    address: "Industriestraße 12, 1100 Wien",
    languages: ["en", "de", "sr"],
    locations: ["Wien Zentrum", "Wien Süd", "Graz"],
    chatWebhook: "",
    status: "active",
    createdAt: "2026-01-15",
    carsCount: 0
  }
];

const SAMPLE_CARS = [
  {
    id: "car-001", dealerId: "ag-motors",
    make: "Volkswagen", model: "Taigo", trim: "1.0 TSI Life",
    year: 2022, price: 15990, mileage: 77600,
    fuel: "gasoline", transmission: "manual", drivetrain: "FWD",
    bodyType: "SUV", condition: "used", status: "available",
    engineCC: 999, hp: 110, color: "White",
    media: [
      {type:"image", url:"https://picsum.photos/seed/vwtaigo1/800/600"},
      {type:"image", url:"https://picsum.photos/seed/vwtaigo2/800/600"},
      {type:"video", url:"https://www.youtube.com/embed/dQw4w9WgXcQ"}
    ],
    features: ["Virtual Cockpit", "Lane Assist", "Heated Seats", "Apple CarPlay"]
  },
  {
    id: "car-002", dealerId: "ag-motors",
    make: "Mitsubishi", model: "Eclipse Cross", trim: "1.5 TC 4WD Intense CVT",
    year: 2019, price: 7990, mileage: 239700,
    fuel: "gasoline", transmission: "automatic", drivetrain: "AWD",
    bodyType: "SUV", condition: "used", status: "available",
    engineCC: 1499, hp: 163, color: "Gray",
    media: [
      {type:"image", url:"https://picsum.photos/seed/eclipse1/800/600"},
      {type:"image", url:"https://picsum.photos/seed/eclipse2/800/600"}
    ],
    features: ["AWD", "Panoramic Roof", "360 Camera", "Keyless Entry"]
  },
  {
    id: "car-003", dealerId: "ag-motors",
    make: "BMW", model: "320d", trim: "M Sport xDrive",
    year: 2021, price: 34990, mileage: 45200,
    fuel: "diesel", transmission: "automatic", drivetrain: "AWD",
    bodyType: "Sedan", condition: "used", status: "available",
    engineCC: 1995, hp: 190, color: "Black",
    media: [
      {type:"image", url:"https://picsum.photos/seed/bmw1/800/600"},
      {type:"video", url:"https://www.youtube.com/embed/ScMzIvxBSi4"},
      {type:"image", url:"https://picsum.photos/seed/bmw2/800/600"}
    ],
    features: ["M Sport Package", "Leather Interior", "Head-Up Display", "Harman Kardon"]
  }
];

// ── Icons (inline SVG components) ──
const Icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  dealers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
      <path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/>
    </svg>
  ),
  car: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14M5 17a2 2 0 01-2-2V9a1 1 0 011-1l3-3h10l3 3a1 1 0 011 1v6a2 2 0 01-2 2M5 17a2 2 0 002 2h1a2 2 0 002-2M14 17a2 2 0 002 2h1a2 2 0 002-2"/>
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  eye: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  edit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
  ),
  back: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  globe: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
  chat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  upload: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  fuel: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 22V5a2 2 0 012-2h8a2 2 0 012 2v17"/><path d="M15 10h2a2 2 0 012 2v5a2 2 0 004 0V9l-3-3"/></svg>,
  speed: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  gear: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4m-7.8-5.2l2.8-2.8m10-4l2.8-2.8M1 12h4m14 0h4m-5.2 7.8l-2.8-2.8m-4-10L6.2 4.2"/></svg>,
  link: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>,
  calendar: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  road: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19L8 5"/><path d="M16 5l4 14"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="11" x2="12" y2="13"/><line x1="12" y1="16" x2="12" y2="18"/></svg>,
  gearbox: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v2a4 4 0 004 4h4a4 4 0 004-4V8"/></svg>,
  fuelPump: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 22V5a2 2 0 012-2h8a2 2 0 012 2v17"/><path d="M15 10h2a2 2 0 012 2v5a2 2 0 004 0V9l-3-3"/></svg>,
  volume: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>,
  fileText: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  bulb: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  alertTriangle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  camera: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  palette: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.02a1.5 1.5 0 011.11-2.48h1.78A5 5 0 0022 12c0-5.52-4.48-10-10-10z"/></svg>,
  star: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  wrench: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
  building: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/></svg>,
  user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  pen: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="2" x2="22" y2="6"/><path d="M7.5 20.5L2 22l1.5-5.5L17 3l4 4L7.5 20.5z"/></svg>,
  image: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  phone: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>,
  mapPin: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  bot: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>,
  msgSquare: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  zap: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  list: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  store: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l1-4h16l1 4"/><path d="M3 9v12h18V9"/><path d="M9 21V13h6v8"/></svg>,
};

// ═══════════════════════════════════════════════════
// SUPER ADMIN PANEL
// ═══════════════════════════════════════════════════
function AdminPanel({ onPreview, dealers, setDealers, cars, setCars, currentUser, onLogout, apiStatus }) {
  const [page, setPage] = useState("dashboard");
  const [editingDealer, setEditingDealer] = useState(null);
  const [editingCar, setEditingCar] = useState(null);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [users, setUsers] = useState([]);

  const isAdmin = currentUser?.role === "admin";
  const isDealer = currentUser?.role === "dealer";
  const myDealerId = currentUser?.dealerId;

  // Load users from storage
  useEffect(() => {
    (async () => { const u = await DB.get("autohouse-users"); if (u) setUsers(u); })();
  }, []);

  // Filter cars for dealer role
  const visibleCars = isDealer ? cars.filter(c => c.dealerId === myDealerId) : cars;
  const visibleDealers = isDealer ? dealers.filter(d => d.id === myDealerId) : dealers;
  const myDealer = isDealer ? dealers.find(d => d.id === myDealerId) : null;

  const stats = {
    totalDealers: visibleDealers.length,
    activeDealers: visibleDealers.filter(d => d.status === "active").length,
    totalCars: visibleCars.length,
    availableCars: visibleCars.filter(c => c.status === "available").length,
    totalValue: visibleCars.reduce((s, c) => s + (c.price || 0), 0),
  };

  const saveDealer = async (dealer) => {
    try {
      if (API_AVAILABLE) {
        if (dealers.find(d => d.id === dealer.id)) {
          await API.updateDealer(dealer.id, dealer);
        } else {
          await API.createDealer(dealer);
        }
      }
    } catch (e) { console.warn("API save dealer failed, saving locally:", e.message); }
    
    if (dealers.find(d => d.id === dealer.id)) {
      setDealers(prev => prev.map(d => d.id === dealer.id ? dealer : d));
    } else {
      setDealers(prev => [...prev, dealer]);
    }
    setEditingDealer(null);
  };

  const saveCar = async (car) => {
    try {
      if (API_AVAILABLE) {
        if (cars.find(c => c.id === car.id)) {
          await API.updateCar(car.id, car);
        } else {
          await API.createCar(car);
        }
      }
    } catch (e) { console.warn("API save car failed, saving locally:", e.message); }

    if (cars.find(c => c.id === car.id)) {
      setCars(prev => prev.map(c => c.id === car.id ? car : c));
    } else {
      setCars(prev => [...prev, car]);
    }
    setEditingCar(null);
  };

  const deleteCar = async (carId) => {
    try { if (API_AVAILABLE) await API.deleteCar(carId); } catch(e) {}
    setCars(prev => prev.filter(c => c.id !== carId));
  };

  return (
    <div style={{display:"flex", height:"100vh", background:"#0a0a0a", color:"#e5e5e5", fontFamily:"'Inter',system-ui,sans-serif"}}>
      {/* Sidebar */}
      <div style={{width:240, background:"#111", borderRight:"1px solid #222", display:"flex", flexDirection:"column", flexShrink:0}}>
        <div style={{padding:"20px 16px", borderBottom:"1px solid #222"}}>
          <div style={{fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#666", marginBottom:4}}>AutoHouse</div>
          <div style={{fontSize:16, fontWeight:700, color:"#fff"}}>{isDealer ? (myDealer?.name || "Dealer Panel") : "Admin Panel"}</div>
          {isDealer && <div style={{fontSize:11, color:"#c8ff00", marginTop:2}}>Dealer pristup</div>}
        </div>
        <nav style={{flex:1, padding:"8px"}}>
          {[
            {id:"dashboard", icon:Icons.dashboard, label:"Dashboard", show:true},
            {id:"dealers", icon:Icons.dealers, label:"Autokuće", show:isAdmin},
            {id:"mydealer", icon:Icons.edit, label:"Moja autokuća", show:isDealer},
            {id:"cars", icon:Icons.car, label: isDealer ? "Moja vozila" : "Sva vozila", show:true},
            {id:"users", icon:Icons.user, label:"Korisnici", show:isAdmin},
            {id:"settings", icon:Icons.settings, label:"Podešavanja", show:isAdmin},
          ].filter(i => i.show).map(item => (
            <button key={item.id} onClick={() => { setPage(item.id); setEditingDealer(null); setEditingCar(null); }}
              style={{
                width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500,
                background: page === item.id ? "#c8ff0015" : "transparent",
                color: page === item.id ? "#c8ff00" : "#888",
                transition:"all 0.15s"
              }}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <div style={{padding:16, borderTop:"1px solid #222"}}>
          {currentUser && (
            <div style={{marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <div style={{width:28, height:28, borderRadius:8, background:"#c8ff0020", color:"#c8ff00", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700}}>
                  {(currentUser.name || currentUser.email || "A")[0].toUpperCase()}
                </div>
                <div>
                  <div style={{fontSize:12, fontWeight:600, color:"#ccc"}}>{currentUser.name || "Admin"}</div>
                  <div style={{fontSize:10, color:"#555"}}>{currentUser.email}</div>
                </div>
              </div>
              <button onClick={onLogout} title="Odjavi se"
                style={{background:"none", border:"none", cursor:"pointer", color:"#555", padding:4}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          )}
          <div style={{fontSize:11, color:"#555"}}>v1.0 · Powered by AutoHouse</div>
          <div style={{fontSize:10, color: apiStatus === "online" ? "#4ade80" : "#f59e0b", marginTop:4, display:"flex", alignItems:"center", gap:4}}>
            <div style={{width:5, height:5, borderRadius:"50%", background: apiStatus === "online" ? "#4ade80" : "#f59e0b"}} />
            {apiStatus === "online" ? "API connected" : "Offline mode (local data)"}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{flex:1, overflow:"auto", padding:32}}>
        {/* DASHBOARD */}
        {page === "dashboard" && !editingDealer && (
          <div>
            <h1 style={{fontSize:24, fontWeight:700, marginBottom:24, color:"#fff"}}>Dashboard</h1>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:32}}>
              {[
                {label:"Autokuće", value:stats.totalDealers, sub:`${stats.activeDealers} aktivnih`, color:"#c8ff00"},
                {label:"Ukupno vozila", value:stats.totalCars, sub:`${stats.availableCars} dostupnih`, color:"#00d4ff"},
                {label:"Ukupna vrednost", value:`€${(stats.totalValue/1000).toFixed(0)}k`, sub:"sva vozila", color:"#ff6b6b"},
              ].map((s,i) => (
                <div key={i} style={{background:"#151515", border:"1px solid #222", borderRadius:12, padding:20}}>
                  <div style={{fontSize:11, textTransform:"uppercase", letterSpacing:1, color:"#666", marginBottom:8}}>{s.label}</div>
                  <div style={{fontSize:28, fontWeight:700, color:s.color}}>{s.value}</div>
                  <div style={{fontSize:12, color:"#555", marginTop:4}}>{s.sub}</div>
                </div>
              ))}
            </div>
            <h2 style={{fontSize:16, fontWeight:600, marginBottom:16}}>{isDealer ? "Moja autokuća" : "Autokuće"}</h2>
            <div style={{display:"grid", gap:12}}>
              {visibleDealers.map(d => (
                <div key={d.id} style={{background:"#151515", border:"1px solid #222", borderRadius:12, padding:16, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                  <div style={{display:"flex", alignItems:"center", gap:12}}>
                    <div style={{width:40, height:40, borderRadius:10, background:d.accent+"20", color:d.accent, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:14}}>{d.logo}</div>
                    <div>
                      <div style={{fontWeight:600, color:"#fff"}}>{d.name}</div>
                      <div style={{fontSize:12, color:"#666"}}>{cars.filter(c=>c.dealerId===d.id).length} vozila · {d.status}</div>
                    </div>
                  </div>
                  <div style={{display:"flex", gap:8}}>
                    <button onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}#/dealer/${d.slug||d.id}`;
                      navigator.clipboard?.writeText(url); 
                    }} style={{...btnSmall, background:"#222", color:"#888"}} title="Kopiraj javni link">{Icons.link}</button>
                    <button onClick={() => onPreview(d.id)} style={{...btnSmall, background:"#222", color:"#ccc"}}>{Icons.eye} Pregledaj</button>
                    <button onClick={() => { setPage("dealers"); setEditingDealer(d); }} style={{...btnSmall, background:"#c8ff0020", color:"#c8ff00"}}>{Icons.edit} Uredi</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEALERS LIST */}
        {page === "dealers" && !editingDealer && (
          <div>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
              <h1 style={{fontSize:24, fontWeight:700, color:"#fff"}}>Autokuće</h1>
              <button onClick={() => setEditingDealer({
                id: `dealer-${Date.now()}`, name:"", slug:"", logo:"", logoImage:"", accent:"#c8ff00", accentSecondary:"#ff6b6b",
                bgImage:"", bgOverlayOpacity:0.7, avatarName:"", avatarImage:"", chatHeaderImage:"",
                welcomeHeadline:"Dream Machine", welcomeSubline:"Hello, ready to find your",
                tagline:"", phone:"", email:"", address:"",
                languages:["en"], locations:[], chatWebhook:"", status:"active", createdAt: new Date().toISOString().split("T")[0], carsCount:0
              })} style={{...btnPrimary}}>{Icons.plus} Dodaj autokuću</button>
            </div>
            {dealers.map(d => (
              <div key={d.id} style={{background:"#151515", border:"1px solid #222", borderRadius:12, padding:20, marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <div style={{display:"flex", alignItems:"center", gap:16}}>
                  <div style={{width:48, height:48, borderRadius:12, background:d.accent+"20", color:d.accent, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:16}}>{d.logo || d.name[0]}</div>
                  <div>
                    <div style={{fontWeight:600, fontSize:15, color:"#fff"}}>{d.name}</div>
                    <div style={{fontSize:12, color:"#666", marginTop:2}}>{d.address} · {cars.filter(c=>c.dealerId===d.id).length} vozila</div>
                  </div>
                </div>
                <div style={{display:"flex", gap:8, alignItems:"center"}}>
                  <div style={{fontSize:11, color:"#444", marginRight:4, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                    #/dealer/{d.slug||d.id}
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#/dealer/${d.slug||d.id}`); }} style={{...btnSmall, background:"#222"}} title="Kopiraj link">{Icons.link}</button>
                  <button onClick={() => onPreview(d.id)} style={{...btnSmall, background:"#222"}}>{Icons.eye}</button>
                  <button onClick={() => setEditingDealer(d)} style={{...btnSmall, background:"#222"}}>{Icons.edit}</button>
                  <button onClick={() => { setSelectedDealer(d.id); setPage("cars"); }} style={{...btnSmall, background:"#222"}}>{Icons.car}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DEALER EDIT FORM */}
        {editingDealer && (
          <DealerForm dealer={editingDealer} onSave={saveDealer} onCancel={() => setEditingDealer(null)} />
        )}

        {/* CARS LIST */}
        {page === "cars" && !editingCar && (
          <div>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
              <div>
                <h1 style={{fontSize:24, fontWeight:700, color:"#fff"}}>Vozila</h1>
                {selectedDealer && <button onClick={() => setSelectedDealer(null)} style={{fontSize:12, color:"#c8ff00", background:"none", border:"none", cursor:"pointer", marginTop:4}}>← Prikaži sva</button>}
              </div>
              <div style={{display:"flex", gap:12}}>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#555"}}>{Icons.search}</span>
                  <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Pretraži..."
                    style={{...inputStyle, paddingLeft:34, width:220}} />
                </div>
                {isAdmin && (
                  <select value={selectedDealer||""} onChange={e=>setSelectedDealer(e.target.value||null)}
                    style={{...inputStyle, width:180}}>
                    <option value="">Sve autokuće</option>
                    {dealers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}
                <button onClick={() => setShowImport(true)} style={{...btnSmall, padding:"8px 16px", background:"#1a1a2e", color:"#8888ff", border:"1px solid #333"}}>
                  {Icons.upload} CSV Import
                </button>
                <button onClick={() => setEditingCar({
                  id:`car-${Date.now()}`, dealerId: isDealer ? myDealerId : (selectedDealer || dealers[0]?.id || ""),
                  make:"", model:"", trim:"", year:2024, price:0, mileage:0,
                  fuel:"gasoline", transmission:"manual", drivetrain:"FWD",
                  bodyType:"Sedan", condition:"used", status:"available",
                  engineCC:0, hp:0, color:"", media:[], features:[]
                })} style={{...btnPrimary}}>{Icons.plus} Dodaj vozilo</button>
              </div>
            </div>
            <div style={{background:"#151515", border:"1px solid #222", borderRadius:12, overflow:"hidden"}}>
              <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:"1px solid #222"}}>
                    {["Vozilo","Cena","Km","Gorivo","Status", ...(isAdmin ? ["Autokuća"] : []),""].map((h,i) => (
                      <th key={i} style={{padding:"12px 16px", textAlign:"left", fontSize:11, textTransform:"uppercase", letterSpacing:1, color:"#555", fontWeight:600}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleCars
                    .filter(c => !selectedDealer || c.dealerId === selectedDealer)
                    .filter(c => !searchQ || `${c.make} ${c.model}`.toLowerCase().includes(searchQ.toLowerCase()))
                    .map(c => (
                    <tr key={c.id} style={{borderBottom:"1px solid #1a1a1a"}}>
                      <td style={{padding:"12px 16px"}}>
                        <div style={{fontWeight:600, color:"#fff"}}>{c.make} {c.model}</div>
                        <div style={{fontSize:11, color:"#666"}}>{c.trim} · {c.year}</div>
                      </td>
                      <td style={{padding:"12px 16px", color:"#c8ff00", fontWeight:600}}>€{c.price?.toLocaleString()}</td>
                      <td style={{padding:"12px 16px", color:"#999"}}>{c.mileage?.toLocaleString()} km</td>
                      <td style={{padding:"12px 16px", color:"#999", textTransform:"capitalize"}}>{c.fuel}</td>
                      <td style={{padding:"12px 16px"}}>
                        <span style={{padding:"3px 8px", borderRadius:6, fontSize:11, fontWeight:600,
                          background: c.status==="available" ? "#c8ff0015" : "#ff6b6b15",
                          color: c.status==="available" ? "#c8ff00" : "#ff6b6b"
                        }}>{c.status}</span>
                      </td>
                      {isAdmin && <td style={{padding:"12px 16px", fontSize:12, color:"#666"}}>{dealers.find(d=>d.id===c.dealerId)?.name || "—"}</td>}
                      <td style={{padding:"12px 16px"}}>
                        <div style={{display:"flex", gap:6}}>
                          <button onClick={() => setEditingCar(c)} style={{...btnSmall, padding:"4px 8px"}}>{Icons.edit}</button>
                          <button onClick={() => deleteCar(c.id)} style={{...btnSmall, padding:"4px 8px", color:"#ff6b6b"}}>{Icons.trash}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleCars.filter(c => !selectedDealer || c.dealerId === selectedDealer).length === 0 && (
                <div style={{padding:40, textAlign:"center", color:"#555"}}>Nema vozila. Dodaj prvo vozilo.</div>
              )}
            </div>
          </div>
        )}

        {/* CAR EDIT FORM */}
        {editingCar && (
          <CarForm car={editingCar} dealers={dealers} onSave={saveCar} onCancel={() => setEditingCar(null)} />
        )}

        {/* CSV IMPORT MODAL */}
        {showImport && (
          <CSVImportModal
            dealers={dealers}
            defaultDealerId={selectedDealer || dealers[0]?.id}
            onImport={(newCars) => { setCars(prev => [...prev, ...newCars]); setShowImport(false); }}
            onClose={() => setShowImport(false)}
          />
        )}

        {/* SETTINGS */}
        {page === "settings" && (
          <div>
            <h1 style={{fontSize:24, fontWeight:700, color:"#fff", marginBottom:24}}>Podešavanja</h1>
            <div style={{background:"#151515", border:"1px solid #222", borderRadius:12, padding:24}}>
              <h3 style={{fontSize:14, fontWeight:600, marginBottom:16}}>Platforma</h3>
              <div style={{display:"grid", gap:12}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #1a1a1a"}}>
                  <div><div style={{fontWeight:500}}>Naziv platforme</div><div style={{fontSize:12, color:"#666"}}>Prikazuje se u admin panelu</div></div>
                  <input defaultValue="AutoHouse" style={{...inputStyle, width:200}} />
                </div>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #1a1a1a"}}>
                  <div><div style={{fontWeight:500}}>Podrazumevani jezik</div><div style={{fontSize:12, color:"#666"}}>Za nove autokuće</div></div>
                  <select defaultValue="en" style={{...inputStyle, width:200}}>
                    <option value="en">English</option><option value="de">Deutsch</option><option value="sr">Srpski</option>
                  </select>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0"}}>
                  <div><div style={{fontWeight:500}}>AI Chat</div><div style={{fontSize:12, color:"#666"}}>Webhook endpoint za chat</div></div>
                  <input defaultValue="" placeholder="https://your-webhook-url.com/chat" style={{...inputStyle, width:340}} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MY DEALER (dealer role only) */}
        {page === "mydealer" && isDealer && myDealer && (
          <DealerForm dealer={myDealer} onSave={(d) => {
            setDealers(prev => prev.map(x => x.id === d.id ? d : x));
          }} onCancel={() => setPage("dashboard")} />
        )}

        {/* USERS MANAGEMENT (admin only) */}
        {page === "users" && isAdmin && (
          <div>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
              <div>
                <h1 style={{fontSize:24, fontWeight:700, color:"#fff"}}>Korisnici</h1>
                <p style={{fontSize:13, color:"#666", marginTop:4}}>Upravljaj admin i dealer nalozima</p>
              </div>
              <button onClick={() => setShowCreateUser(true)} style={{...btnPrimary}}>{Icons.plus} Novi korisnik</button>
            </div>

            <div style={{display:"grid", gap:12}}>
              {users.map((u,i) => (
                <div key={i} style={{background:"#151515", border:"1px solid #222", borderRadius:12, padding:16, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                  <div style={{display:"flex", alignItems:"center", gap:12}}>
                    <div style={{width:40, height:40, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:14,
                      background: u.role === "admin" ? "#c8ff0020" : "#00d4ff20",
                      color: u.role === "admin" ? "#c8ff00" : "#00d4ff"
                    }}>{(u.name||u.email||"?")[0].toUpperCase()}</div>
                    <div>
                      <div style={{fontWeight:600, color:"#fff"}}>{u.name || u.email}</div>
                      <div style={{fontSize:12, color:"#666"}}>
                        {u.email} ·{" "}
                        <span style={{color: u.role === "admin" ? "#c8ff00" : "#00d4ff"}}>{u.role}</span>
                        {u.dealerId && ` · ${dealers.find(d=>d.id===u.dealerId)?.name || u.dealerId}`}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex", gap:8}}>
                    {u.id !== currentUser?.userId && u.id !== currentUser?.id && (
                      <button onClick={async () => {
                        const updated = users.filter(x => x.id !== u.id);
                        setUsers(updated);
                        await DB.set("autohouse-users", updated);
                      }} style={{...btnSmall, color:"#ff6b6b"}}>{Icons.trash}</button>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div style={{padding:40, textAlign:"center", color:"#555"}}>Nema korisnika.</div>
              )}
            </div>

            {/* Create User Modal */}
            {showCreateUser && (
              <CreateUserModal
                dealers={dealers}
                onSave={async (newUser) => {
                  const updated = [...users, newUser];
                  setUsers(updated);
                  await DB.set("autohouse-users", updated);
                  setShowCreateUser(false);
                }}
                onClose={() => setShowCreateUser(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dealer Form (Tabbed) ──
const BG_PRESETS = [
  {label:"Showroom", url:"https://picsum.photos/seed/showroom/1600/900"},
  {label:"Luxury Garage", url:"https://picsum.photos/seed/garage/1600/900"},
  {label:"Night City", url:"https://picsum.photos/seed/nightcity/1600/900"},
  {label:"Highway", url:"https://picsum.photos/seed/highway/1600/900"},
  {label:"Modern Building", url:"https://picsum.photos/seed/building/1600/900"},
  {label:"Car Park", url:"https://picsum.photos/seed/carpark/1600/900"},
];
const AVATAR_PRESETS = [
  {label:"Business Man 1", url:"https://picsum.photos/seed/man1/400/400"},
  {label:"Business Woman 1", url:"https://picsum.photos/seed/woman1/400/400"},
  {label:"Business Man 2", url:"https://picsum.photos/seed/man2/400/400"},
  {label:"Business Woman 2", url:"https://picsum.photos/seed/woman2/400/400"},
  {label:"Young Man", url:"https://picsum.photos/seed/man3/400/400"},
  {label:"Professional", url:"https://picsum.photos/seed/pro1/400/400"},
];

function DealerForm({ dealer, onSave, onCancel }) {
  const [form, setForm] = useState({ ...dealer });
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isNew = !dealer.name;
  const [tab, setTab] = useState("basic");

  const tabs = [
    {id:"basic", label:"Osnovno", icon:Icons.fileText},
    {id:"visual", label:"Vizuelni identitet", icon:Icons.palette},
    {id:"welcome", label:"Welcome ekran", icon:Icons.home},
    {id:"contact", label:"Kontakt & lokacije", icon:Icons.mapPin},
    {id:"ai", label:"AI Chat", icon:Icons.bot},
  ];

  const sectionStyle = {background:"#151515", border:"1px solid #222", borderRadius:12, padding:20, marginBottom:16};
  const sectionTitle = (icon, text) => <div style={{fontSize:14, fontWeight:600, color:"#fff", marginBottom:16, display:"flex", alignItems:"center", gap:8}}><span>{icon}</span>{text}</div>;

  return (
    <div>
      <button onClick={onCancel} style={{...btnSmall, marginBottom:16, color:"#888"}}>{Icons.back} Nazad</button>
      <h1 style={{fontSize:24, fontWeight:700, color:"#fff", marginBottom:8}}>{isNew ? "Nova autokuća" : `Uredi: ${dealer.name}`}</h1>
      <p style={{fontSize:13, color:"#666", marginBottom:24}}>Podesi sve detalje za ovu autokuću — od vizuelnog identiteta do AI chat integracije.</p>

      {/* Tabs */}
      <div style={{display:"flex", gap:4, marginBottom:24, borderBottom:"1px solid #222", paddingBottom:0}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{padding:"10px 16px", background:"transparent", border:"none", borderBottom: tab===t.id ? "2px solid #c8ff00" : "2px solid transparent",
              color: tab===t.id ? "#fff" : "#666", fontSize:13, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", gap:6, transition:"all 0.15s"}}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Osnovno ── */}
      {tab === "basic" && (
        <div style={{maxWidth:700}}>
          <div style={sectionStyle}>
            {sectionTitle(Icons.building, "Osnovni podaci")}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
              <Field label="Naziv autokuće" value={form.name} onChange={v=>upd("name",v)} placeholder="npr. AG Motors" />
              <Field label="Slug (URL)" value={form.slug} onChange={v=>upd("slug",v)} placeholder="ag-motors" />
              <Field label="Tagline / Slogan" value={form.tagline} onChange={v=>upd("tagline",v)} span={2} placeholder="Sales | Service | Trust" />
              <div style={{gridColumn:"span 2"}}>
                <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Status</label>
                <select value={form.status} onChange={e=>upd("status", e.target.value)} style={{...inputStyle, width:200}}>
                  <option value="active">Aktivan</option><option value="inactive">Neaktivan</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Vizuelni identitet ── */}
      {tab === "visual" && (
        <div style={{maxWidth:700}}>
          {/* Logo */}
          <div style={sectionStyle}>
            {sectionTitle(Icons.star, "Logo")}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
              <Field label="Logo tekst (kratko, npr. AG)" value={form.logo} onChange={v=>upd("logo",v)} placeholder="AG" />
              <Field label="Logo slika URL (opcionalno)" value={form.logoImage} onChange={v=>upd("logoImage",v)} placeholder="https://..." />
            </div>
            {/* Logo preview */}
            <div style={{marginTop:16, padding:16, background:"#0a0a0a", borderRadius:10, display:"flex", alignItems:"center", gap:16}}>
              <div style={{fontSize:11, color:"#555", flexShrink:0}}>Preview:</div>
              {form.logoImage ? (
                <Img src={form.logoImage} alt="Logo" style={{height:40, objectFit:"contain"}} />
              ) : (
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <span style={{fontSize:28, fontWeight:800, color:form.accent||"#c8ff00"}}>{form.logo || "??"}</span>
                  <span style={{fontSize:18, fontWeight:300, color:"#fff", letterSpacing:3}}>{form.name?.replace(form.logo,"").trim() || "MOTORS"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Colors */}
          <div style={sectionStyle}>
            {sectionTitle(Icons.palette, "Boje")}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
              <Field label="Primarna (accent) boja" value={form.accent} onChange={v=>upd("accent",v)} type="color" />
              <Field label="Sekundarna boja" value={form.accentSecondary} onChange={v=>upd("accentSecondary",v)} type="color" />
            </div>
            {/* Color preview bar */}
            <div style={{marginTop:12, display:"flex", gap:8}}>
              <div style={{flex:1, height:32, borderRadius:8, background:form.accent||"#c8ff00"}} />
              <div style={{flex:1, height:32, borderRadius:8, background:form.accentSecondary||"#ff6b6b"}} />
              <div style={{flex:1, height:32, borderRadius:8, background:"#111", border:"1px solid #333"}} />
            </div>
          </div>

          {/* Avatar */}
          <div style={sectionStyle}>
            {sectionTitle(Icons.user, "Avatar (prodavac / asistent)")}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16}}>
              <Field label="Ime avatara" value={form.avatarName} onChange={v=>upd("avatarName",v)} placeholder="npr. Marco" />
              <Field label="Slika avatara URL (ili izaberi ispod)" value={form.avatarImage} onChange={v=>upd("avatarImage",v)} placeholder="https://..." />
            </div>
            <div style={{fontSize:12, color:"#555", marginBottom:8}}>Izaberi gotov avatar:</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8}}>
              {AVATAR_PRESETS.map((a, i) => (
                <button key={i} onClick={() => upd("avatarImage", a.url)}
                  style={{border: form.avatarImage === a.url ? `2px solid ${form.accent||"#c8ff00"}` : "2px solid #333",
                    borderRadius:12, overflow:"hidden", cursor:"pointer", padding:0, background:"#111", aspectRatio:"1"}}>
                  <Img src={a.url} alt={a.label} style={{width:"100%", height:"100%", objectFit:"cover"}} />
                </button>
              ))}
            </div>
            {/* Avatar preview */}
            {form.avatarImage && (
              <div style={{marginTop:12, display:"flex", alignItems:"center", gap:12}}>
                <div style={{width:64, height:64, borderRadius:"50%", overflow:"hidden", border:`2px solid ${form.accent||"#c8ff00"}50`, flexShrink:0}}>
                  <Img src={form.avatarImage} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}} />
                </div>
                <div>
                  <div style={{fontWeight:600, color:"#fff"}}>{form.avatarName || "Avatar"}</div>
                  <div style={{fontSize:12, color:"#666"}}>{form.name || "Autokuća"}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Welcome ekran ── */}
      {tab === "welcome" && (
        <div style={{maxWidth:700}}>
          {/* Headlines */}
          <div style={sectionStyle}>
            {sectionTitle(Icons.pen, "Tekst dobrodošlice")}
            <div style={{display:"grid", gridTemplateColumns:"1fr", gap:16}}>
              <Field label="Podnaslov (gornji red)" value={form.welcomeSubline} onChange={v=>upd("welcomeSubline",v)} placeholder="Hello, ready to find your" />
              <Field label="Glavni naslov (donji red, bold)" value={form.welcomeHeadline} onChange={v=>upd("welcomeHeadline",v)} placeholder="Dream Machine?" />
            </div>
          </div>

          {/* Background Image */}
          <div style={sectionStyle}>
            {sectionTitle(Icons.image, "Pozadinska slika")}
            <Field label="URL slike (ili izaberi ispod)" value={form.bgImage} onChange={v=>upd("bgImage",v)} placeholder="https://..." />
            <div style={{fontSize:12, color:"#555", marginBottom:8, marginTop:12}}>Izaberi gotovu pozadinu:</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8}}>
              {BG_PRESETS.map((bg, i) => (
                <button key={i} onClick={() => upd("bgImage", bg.url)}
                  style={{border: form.bgImage === bg.url ? `2px solid ${form.accent||"#c8ff00"}` : "2px solid #333",
                    borderRadius:10, overflow:"hidden", cursor:"pointer", padding:0, background:"#111", position:"relative", aspectRatio:"16/9"}}>
                  <Img src={bg.url} alt={bg.label} style={{width:"100%", height:"100%", objectFit:"cover"}} />
                  <div style={{position:"absolute", bottom:0, left:0, right:0, padding:"4px 8px", background:"#000a", fontSize:10, color:"#ccc"}}>{bg.label}</div>
                </button>
              ))}
            </div>

            {/* Overlay opacity */}
            <div style={{marginTop:16}}>
              <label style={{fontSize:12, color:"#666", marginBottom:8, display:"block"}}>Zatamnjenje pozadine: {Math.round((form.bgOverlayOpacity||0.7)*100)}%</label>
              <input type="range" min="0" max="100" value={Math.round((form.bgOverlayOpacity||0.7)*100)}
                onChange={e => upd("bgOverlayOpacity", parseInt(e.target.value)/100)}
                style={{width:"100%", accentColor:form.accent||"#c8ff00"}} />
            </div>
          </div>

          {/* Live Preview */}
          <div style={sectionStyle}>
            {sectionTitle(Icons.eye, "Preview")}
            <div style={{
              borderRadius:12, overflow:"hidden", height:200, position:"relative",
              background: `linear-gradient(to bottom, rgba(15,15,13,${(form.bgOverlayOpacity||0.7)*0.7}), rgba(15,15,13,${form.bgOverlayOpacity||0.7})), url('${form.bgImage || BG_PRESETS[0].url}') center/cover no-repeat`
            }}>
              <div style={{position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8}}>
                {form.avatarImage ? (
                  <div style={{width:48, height:48, borderRadius:"50%", overflow:"hidden", border:`2px solid ${form.accent||"#c8ff00"}50`}}>
                    <Img src={form.avatarImage} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}} />
                  </div>
                ) : (
                  <div style={{width:48, height:48, borderRadius:"50%", background:`${form.accent||"#c8ff00"}20`, border:`2px solid ${form.accent||"#c8ff00"}50`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:form.accent||"#c8ff00"}}>
                    {form.avatarName?.[0] || form.logo?.[0] || "?"}
                  </div>
                )}
                <div style={{fontSize:14, color:"#f0ece4cc"}}>{form.welcomeSubline || "Hello, ready to find your"}</div>
                <div style={{fontSize:18, fontWeight:700, color:"#fff"}}>{form.welcomeHeadline || "Dream Machine?"}</div>
                <div style={{marginTop:8, display:"flex", alignItems:"center", gap:6}}>
                  {form.logoImage ? <Img src={form.logoImage} style={{height:20}} /> : <span style={{fontSize:16, fontWeight:800, color:form.accent||"#c8ff00"}}>{form.logo||"??"}</span>}
                  <span style={{fontSize:12, fontWeight:300, color:"#fff", letterSpacing:2}}>{form.name?.replace(form.logo,"").trim()||"MOTORS"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Kontakt ── */}
      {tab === "contact" && (
        <div style={{maxWidth:700}}>
          <div style={sectionStyle}>
            {sectionTitle(Icons.phone, "Kontakt podaci")}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
              <Field label="Telefon" value={form.phone} onChange={v=>upd("phone",v)} placeholder="+43 1 234 5678" />
              <Field label="Email" value={form.email} onChange={v=>upd("email",v)} placeholder="info@dealer.com" />
              <Field label="Adresa" value={form.address} onChange={v=>upd("address",v)} span={2} placeholder="Ulica i broj, grad" />
            </div>
          </div>
          <div style={sectionStyle}>
            {sectionTitle(Icons.mapPin, "Lokacije za probnu vožnju")}
            <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Lokacije (odvojene zarezom)</label>
            <input value={(form.locations||[]).join(", ")} onChange={e=>upd("locations", e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}
              style={{...inputStyle, width:"100%"}} placeholder="Wien Zentrum, Wien Süd, Graz" />
          </div>
          <div style={sectionStyle}>
            {sectionTitle(Icons.globe, "Jezici")}
            <div style={{display:"flex", gap:8}}>
              {[{id:"en",label:"English"},{id:"de",label:"Deutsch"},{id:"sr",label:"Srpski"}].map(l => (
                <button key={l.id} onClick={() => {
                  const langs = form.languages||[];
                  upd("languages", langs.includes(l.id) ? langs.filter(x=>x!==l.id) : [...langs, l.id]);
                }}
                  style={{padding:"8px 16px", borderRadius:8, border:"1px solid #333", cursor:"pointer", fontSize:12, fontWeight:500,
                    background: (form.languages||[]).includes(l.id) ? `${form.accent||"#c8ff00"}20` : "#111",
                    color: (form.languages||[]).includes(l.id) ? form.accent||"#c8ff00" : "#888"
                  }}>{l.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: AI Chat ── */}
      {tab === "ai" && (
        <div style={{maxWidth:700}}>
          <div style={sectionStyle}>
            {sectionTitle(Icons.bot, "AI Chat podešavanja")}
            <Field label="Chat webhook URL (n8n ili custom endpoint)" value={form.chatWebhook} onChange={v=>upd("chatWebhook",v)} placeholder="https://n8n.example.com/webhook/chat" />
            <div style={{fontSize:12, color:"#555", marginTop:8}}>Ovo je endpoint gde se šalju korisničke poruke. AI odgovor se očekuje u JSON formatu.</div>
          </div>
          <div style={sectionStyle}>
            {sectionTitle(Icons.volume, "TTS / STT")}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
              <Field label="ElevenLabs API Key (opcionalno)" value={form.ttsApiKey||""} onChange={v=>upd("ttsApiKey",v)} placeholder="sk-..." />
              <Field label="ElevenLabs Voice ID" value={form.ttsVoiceId||""} onChange={v=>upd("ttsVoiceId",v)} placeholder="voice-id" />
            </div>
          </div>
          <div style={sectionStyle}>
            {sectionTitle(Icons.msgSquare, "Chat header slika")}
            <Field label="Slika za header chat panela (opcionalno)" value={form.chatHeaderImage||""} onChange={v=>upd("chatHeaderImage",v)} placeholder="https://..." />
            <div style={{fontSize:12, color:"#555", marginTop:4}}>Prikazuje se iznad chat poruka. Ako je prazno, koristi se logo sa accent bojom.</div>
          </div>
        </div>
      )}

      {/* Save / Cancel */}
      <div style={{marginTop:24, display:"flex", gap:12, paddingBottom:40}}>
        <button onClick={() => onSave({ ...form, slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-+$/,"") })} style={{...btnPrimary, padding:"10px 28px", fontSize:14}}>Sačuvaj autokuću</button>
        <button onClick={onCancel} style={{...btnSmall, padding:"10px 20px"}}>Otkaži</button>
      </div>
    </div>
  );
}

// ── Car Form ──
function CarForm({ car, dealers, onSave, onCancel }) {
  const [form, setForm] = useState({ ...car });
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const [featuresText, setFeaturesText] = useState((car.features||[]).join(", "));
  // Convert media array to editable text lines: "image:url" or "video:url"
  const [mediaText, setMediaText] = useState(
    (car.media||car.images?.map(u=>({type:"image",url:u}))||[]).map(m => `${m.type}:${m.url}`).join("\n")
  );

  return (
    <div>
      <button onClick={onCancel} style={{...btnSmall, marginBottom:16, color:"#888"}}>{Icons.back} Nazad</button>
      <h1 style={{fontSize:24, fontWeight:700, color:"#fff", marginBottom:24}}>{car.make ? `Uredi: ${car.make} ${car.model}` : "Novo vozilo"}</h1>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, maxWidth:900}}>
        <div>
          <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Autokuća</label>
          <select value={form.dealerId} onChange={e=>upd("dealerId", e.target.value)} style={{...inputStyle, width:"100%"}}>
            {dealers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <Field label="Marka" value={form.make} onChange={v=>upd("make",v)} />
        <Field label="Model" value={form.model} onChange={v=>upd("model",v)} />
        <Field label="Trim" value={form.trim} onChange={v=>upd("trim",v)} />
        <Field label="Godina" value={form.year} onChange={v=>upd("year",parseInt(v)||0)} type="number" />
        <Field label="Cena (€)" value={form.price} onChange={v=>upd("price",parseInt(v)||0)} type="number" />
        <Field label="Kilometraža" value={form.mileage} onChange={v=>upd("mileage",parseInt(v)||0)} type="number" />
        <Field label="KS" value={form.hp} onChange={v=>upd("hp",parseInt(v)||0)} type="number" />
        <Field label="Kubikaža (cc)" value={form.engineCC} onChange={v=>upd("engineCC",parseInt(v)||0)} type="number" />
        <div>
          <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Gorivo</label>
          <select value={form.fuel} onChange={e=>upd("fuel",e.target.value)} style={{...inputStyle, width:"100%"}}>
            <option value="gasoline">Benzin</option><option value="diesel">Dizel</option>
            <option value="hybrid">Hibrid</option><option value="electric">Elektro</option>
          </select>
        </div>
        <div>
          <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Menjač</label>
          <select value={form.transmission} onChange={e=>upd("transmission",e.target.value)} style={{...inputStyle, width:"100%"}}>
            <option value="manual">Manuelni</option><option value="automatic">Automatik</option>
          </select>
        </div>
        <div>
          <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Pogon</label>
          <select value={form.drivetrain} onChange={e=>upd("drivetrain",e.target.value)} style={{...inputStyle, width:"100%"}}>
            <option value="FWD">FWD</option><option value="RWD">RWD</option><option value="AWD">AWD</option>
          </select>
        </div>
        <Field label="Tip karoserije" value={form.bodyType} onChange={v=>upd("bodyType",v)} />
        <Field label="Boja" value={form.color} onChange={v=>upd("color",v)} />
        <div>
          <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Status</label>
          <select value={form.status} onChange={e=>upd("status",e.target.value)} style={{...inputStyle, width:"100%"}}>
            <option value="available">Dostupan</option><option value="reserved">Rezervisan</option><option value="sold">Prodat</option>
          </select>
        </div>
        <div style={{gridColumn:"span 3"}}>
          <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Mediji — slike i videi (jedan po redu, format: <span style={{color:"#c8ff00"}}>image:URL</span> ili <span style={{color:"#c8ff00"}}>video:URL</span>)</label>
          <textarea value={mediaText} onChange={e=>setMediaText(e.target.value)} rows={4}
            style={{...inputStyle, width:"100%", resize:"vertical"}} placeholder={"image:https://example.com/photo.jpg\nvideo:https://www.youtube.com/embed/xxxxx\nimage:https://example.com/photo2.jpg"} />
          <div style={{fontSize:11, color:"#555", marginTop:4}}>Za YouTube koristite embed URL (youtube.com/embed/ID). Za direktne .mp4 fajlove koristite pun URL.</div>
        </div>
        <div style={{gridColumn:"span 3"}}>
          <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Oprema (odvojeno zarezom)</label>
          <input value={featuresText} onChange={e=>setFeaturesText(e.target.value)}
            style={{...inputStyle, width:"100%"}} placeholder="Klima, Navigacija, ..." />
        </div>
      </div>
      <div style={{marginTop:24, display:"flex", gap:12}}>
        <button onClick={() => {
          const media = mediaText.split("\n").map(s=>s.trim()).filter(Boolean).map(line => {
            if (line.startsWith("video:")) return {type:"video", url:line.slice(6).trim()};
            if (line.startsWith("image:")) return {type:"image", url:line.slice(6).trim()};
            // Auto-detect: if URL contains youtube/vimeo/mp4, treat as video
            if (/youtube|youtu\.be|vimeo|\.mp4|\.webm/i.test(line)) return {type:"video", url:line};
            return {type:"image", url:line};
          });
          onSave({
            ...form, media,
            features: featuresText.split(",").map(s=>s.trim()).filter(Boolean)
          });
        }} style={{...btnPrimary}}>Sačuvaj</button>
        <button onClick={onCancel} style={{...btnSmall, padding:"8px 20px"}}>Otkaži</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type="text", placeholder="", span=1 }) {
  return (
    <div style={span>1?{gridColumn:`span ${span}`}:{}}>
      <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>{label}</label>
      {type === "color" ? (
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <input type="color" value={value||"#c8ff00"} onChange={e=>onChange(e.target.value)} style={{width:36, height:32, border:"none", borderRadius:6, cursor:"pointer", background:"none"}} />
          <input value={value||""} onChange={e=>onChange(e.target.value)} style={{...inputStyle, flex:1}} />
        </div>
      ) : (
        <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{...inputStyle, width:"100%"}} />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// DEALER STOREFRONT (Customer-Facing)
// ═══════════════════════════════════════════════════
// CREATE USER MODAL
// ═══════════════════════════════════════════════════
function CreateUserModal({ dealers, onSave, onClose }) {
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"dealer", dealerId: dealers[0]?.id || "" });
  const [error, setError] = useState("");
  const upd = (k,v) => setForm(p => ({...p, [k]:v}));

  const handleSave = () => {
    if (!form.email || !form.password) { setError("Email i lozinka su obavezni"); return; }
    if (form.role === "dealer" && !form.dealerId) { setError("Izaberi autokuću za dealer nalog"); return; }
    onSave({
      id: `user-${Date.now()}`,
      name: form.name || form.email.split("@")[0],
      email: form.email,
      password: form.password,
      role: form.role,
      dealerId: form.role === "dealer" ? form.dealerId : null,
    });
  };

  return (
    <div style={{position:"fixed", inset:0, background:"#000c", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center"}}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{background:"#151515", border:"1px solid #222", borderRadius:16, width:440, padding:28}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
          <h2 style={{fontSize:18, fontWeight:700, color:"#fff", margin:0}}>Novi korisnik</h2>
          <button onClick={onClose} style={{background:"#222", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", color:"#888", display:"flex", alignItems:"center", justifyContent:"center"}}>{Icons.close}</button>
        </div>

        <div style={{display:"grid", gap:16}}>
          <div>
            <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Uloga</label>
            <div style={{display:"flex", gap:8}}>
              {[{id:"admin",label:"Admin",desc:"Vidi sve, upravlja svime"},{id:"dealer",label:"Dealer",desc:"Vidi samo svoju autokuću"}].map(r => (
                <button key={r.id} onClick={() => upd("role", r.id)}
                  style={{flex:1, padding:"12px", borderRadius:10, cursor:"pointer", textAlign:"left",
                    background: form.role === r.id ? (r.id === "admin" ? "#c8ff0015" : "#00d4ff15") : "#111",
                    border: form.role === r.id ? `1px solid ${r.id === "admin" ? "#c8ff00" : "#00d4ff"}40` : "1px solid #222",
                    color: form.role === r.id ? "#fff" : "#888"
                  }}>
                  <div style={{fontWeight:600, fontSize:13}}>{r.label}</div>
                  <div style={{fontSize:11, color:"#666", marginTop:2}}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {form.role === "dealer" && (
            <div>
              <label style={{fontSize:12, color:"#666", marginBottom:4, display:"block"}}>Autokuća</label>
              <select value={form.dealerId} onChange={e => upd("dealerId", e.target.value)} style={{...inputStyle, width:"100%"}}>
                {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <Field label="Ime" value={form.name} onChange={v=>upd("name",v)} placeholder="npr. Marco" />
          <Field label="Email" value={form.email} onChange={v=>{upd("email",v);setError("")}} placeholder="dealer@agmotors.at" />
          <Field label="Lozinka" value={form.password} onChange={v=>{upd("password",v);setError("")}} placeholder="••••••••" />

          {error && (
            <div style={{padding:"8px 12px", background:"#ff6b6b15", border:"1px solid #ff6b6b30", borderRadius:8}}>
              <span style={{fontSize:12, color:"#ff6b6b"}}>{error}</span>
            </div>
          )}

          <button onClick={handleSave} style={{...btnPrimary, width:"100%", justifyContent:"center", padding:"12px"}}>
            Kreiraj korisnika
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// CSV IMPORT MODAL
// ═══════════════════════════════════════════════════
const CSV_COLUMN_MAP = {
  make: ["make","marka","brand","hersteller","manufacturer"],
  model: ["model","modell"],
  trim: ["trim","trim_level","ausstattung","oprema","variant"],
  year: ["year","godina","jahr","baujahr","god"],
  price: ["price","cena","preis","cijena","eur"],
  mileage: ["mileage","km","kilometraza","kilometerstand","miles"],
  fuel: ["fuel","gorivo","kraftstoff","fuel_type","motor"],
  transmission: ["transmission","menjac","getriebe","trans"],
  drivetrain: ["drivetrain","pogon","antrieb","drive"],
  bodyType: ["body_type","bodytype","karoserija","typ","body"],
  condition: ["condition","stanje","zustand"],
  hp: ["hp","ks","ps","horsepower","snaga","power"],
  engineCC: ["engine_cc","kubikaza","hubraum","cc","engine"],
  color: ["color","boja","farbe","colour"],
  vin: ["vin","chassis"],
  status: ["status"],
  description: ["description","opis","beschreibung","desc"],
};

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  
  // Simple CSV parser handling quoted fields
  function parseLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) { result.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(l => {
    const vals = parseLine(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  }).filter(r => Object.values(r).some(v => v)); // skip empty rows
  
  return { headers, rows };
}

function autoMapColumn(header) {
  const h = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(CSV_COLUMN_MAP)) {
    if (aliases.includes(h)) return field;
  }
  // Fuzzy: check if header contains any alias
  for (const [field, aliases] of Object.entries(CSV_COLUMN_MAP)) {
    if (aliases.some(a => h.includes(a) || a.includes(h))) return field;
  }
  // Check for image/media columns
  if (/image|slika|bild|photo|foto|media|picture/i.test(h)) return "_image";
  if (/feature|oprema|ausstattung|equipment|options/i.test(h)) return "_features";
  return "";
}

function CSVImportModal({ dealers, defaultDealerId, onImport, onClose }) {
  const [step, setStep] = useState(1); // 1=upload, 2=mapping, 3=preview, 4=done
  const [dealerId, setDealerId] = useState(defaultDealerId || "");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState({ headers: [], rows: [] });
  const [mapping, setMapping] = useState({});
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setRawText(text);
      const p = parseCSV(text);
      setParsed(p);
      // Auto-map columns
      const autoMap = {};
      p.headers.forEach(h => {
        const mapped = autoMapColumn(h);
        if (mapped) autoMap[h] = mapped;
      });
      setMapping(autoMap);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handlePaste = () => {
    if (!rawText.trim()) return;
    const p = parseCSV(rawText);
    setParsed(p);
    const autoMap = {};
    p.headers.forEach(h => {
      const mapped = autoMapColumn(h);
      if (mapped) autoMap[h] = mapped;
    });
    setMapping(autoMap);
    setStep(2);
  };

  const buildCars = () => {
    return parsed.rows.map((row, i) => {
      const car = {
        id: `car-imp-${Date.now()}-${i}`,
        dealerId,
        make: "", model: "", trim: "", year: 0, price: 0, mileage: 0,
        fuel: "gasoline", transmission: "manual", drivetrain: "FWD",
        bodyType: "Sedan", condition: "used", status: "available",
        engineCC: 0, hp: 0, color: "", media: [], features: [], description: "",
      };

      const imageUrls = [];
      let featuresStr = "";

      for (const [csvCol, field] of Object.entries(mapping)) {
        const val = row[csvCol] || "";
        if (!val) continue;

        if (field === "_image") {
          if (val) imageUrls.push(val);
        } else if (field === "_features") {
          featuresStr = val;
        } else if (["year","price","mileage","hp","engineCC"].includes(field)) {
          car[field] = parseFloat(val.replace(/[^0-9.]/g, "")) || 0;
        } else if (field) {
          car[field] = val;
        }
      }

      if (imageUrls.length > 0) {
        car.media = imageUrls.map(url => {
          if (/youtube|vimeo|\.mp4|\.webm/i.test(url)) return { type: "video", url };
          return { type: "image", url };
        });
      }
      if (featuresStr) {
        car.features = featuresStr.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
      }

      return car;
    }).filter(c => c.make && c.model);
  };

  const doImport = () => {
    const newCars = buildCars();
    setImportResult({ total: parsed.rows.length, imported: newCars.length, skipped: parsed.rows.length - newCars.length });
    onImport(newCars);
    setStep(4);
  };

  const previewCars = step >= 3 ? buildCars() : [];

  const modalBg = { position:"fixed", inset:0, background:"#000c", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif" };
  const modalBox = { background:"#151515", border:"1px solid #222", borderRadius:16, width:720, maxHeight:"85vh", overflow:"auto", padding:28 };

  const allFields = [
    {value:"", label:"— Preskoči —"},
    {value:"make", label:"Marka"},
    {value:"model", label:"Model"},
    {value:"trim", label:"Trim/Oprema"},
    {value:"year", label:"Godina"},
    {value:"price", label:"Cena (€)"},
    {value:"mileage", label:"Kilometraža"},
    {value:"fuel", label:"Gorivo"},
    {value:"transmission", label:"Menjač"},
    {value:"drivetrain", label:"Pogon"},
    {value:"bodyType", label:"Karoserija"},
    {value:"condition", label:"Stanje"},
    {value:"hp", label:"KS"},
    {value:"engineCC", label:"Kubikaža"},
    {value:"color", label:"Boja"},
    {value:"vin", label:"VIN"},
    {value:"status", label:"Status"},
    {value:"description", label:"Opis"},
    {value:"_image", label:"• Slika URL"},
    {value:"_features", label:"• Oprema (lista)"},
  ];

  return (
    <div style={modalBg} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalBox}>
        {/* Header */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20}}>
          <div>
            <h2 style={{fontSize:20, fontWeight:700, color:"#fff", margin:0}}>{Icons.download} CSV Import vozila</h2>
            <p style={{fontSize:12, color:"#666", margin:"4px 0 0"}}>
              {step === 1 && "Učitaj CSV/Excel fajl ili nalepi podatke"}
              {step === 2 && "Poveži kolone iz fajla sa poljima vozila"}
              {step === 3 && `Preview — ${previewCars.length} vozila spremno za import`}
              {step === 4 && "Import završen!"}
            </p>
          </div>
          <button onClick={onClose} style={{background:"#222", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", color:"#888", display:"flex", alignItems:"center", justifyContent:"center"}}>{Icons.close}</button>
        </div>

        {/* Steps indicator */}
        <div style={{display:"flex", gap:4, marginBottom:24}}>
          {["Upload","Mapiranje","Preview","Gotovo"].map((s,i) => (
            <div key={i} style={{flex:1, height:3, borderRadius:2, background: step > i ? "#c8ff00" : "#222"}} />
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === 1 && (
          <div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:12, color:"#666", marginBottom:6, display:"block"}}>Autokuća za import</label>
              <select value={dealerId} onChange={e => setDealerId(e.target.value)} style={{...inputStyle, width:"100%"}}>
                {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* File upload area */}
            <div onClick={() => fileRef.current?.click()}
              style={{border:"2px dashed #333", borderRadius:12, padding:40, textAlign:"center", cursor:"pointer", marginBottom:16, transition:"border-color 0.2s"}}>
              <div style={{marginBottom:8, color:"#888"}}>{Icons.upload}</div>
              <div style={{color:"#888", fontSize:14}}>Klikni da izabereš CSV fajl</div>
              <div style={{color:"#555", fontSize:12, marginTop:4}}>ili prevuci fajl ovde</div>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{display:"none"}} />
            </div>

            <div style={{textAlign:"center", color:"#444", fontSize:12, marginBottom:16}}>— ili —</div>

            {/* Paste area */}
            <div>
              <label style={{fontSize:12, color:"#666", marginBottom:6, display:"block"}}>Nalepi podatke (CSV format)</label>
              <textarea value={rawText} onChange={e => setRawText(e.target.value)} rows={6}
                placeholder={"make,model,year,price,km,fuel\nVW,Golf,2023,22990,15000,gasoline\nBMW,320d,2021,34990,45200,diesel"}
                style={{...inputStyle, width:"100%", resize:"vertical", fontFamily:"monospace", fontSize:12}} />
              <button onClick={handlePaste} disabled={!rawText.trim()}
                style={{...btnPrimary, marginTop:12, opacity: rawText.trim() ? 1 : 0.5}}>Parsiraj podatke</button>
            </div>

            {/* Sample format help */}
            <div style={{marginTop:20, padding:16, background:"#111", borderRadius:10, border:"1px solid #1a1a1a"}}>
              <div style={{fontSize:12, fontWeight:600, color:"#888", marginBottom:8, display:"flex", alignItems:"center", gap:6}}>{Icons.bulb} Podržani formati kolona</div>
              <div style={{fontSize:11, color:"#555", lineHeight:1.8}}>
                Marka: make, marka, brand · Model: model · Godina: year, godina · Cena: price, cena · KM: km, mileage, kilometraza ·
                Gorivo: fuel, gorivo · Menjač: transmission, menjac · KS: hp, ks, ps · Boja: color, boja ·
                Slike: image1, foto, slika · Oprema: features, oprema
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Column Mapping */}
        {step === 2 && (
          <div>
            <div style={{background:"#111", borderRadius:10, overflow:"hidden", border:"1px solid #1a1a1a", marginBottom:20}}>
              <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:"1px solid #222"}}>
                    <th style={{padding:"10px 14px", textAlign:"left", color:"#666", fontSize:11, textTransform:"uppercase"}}>Kolona iz fajla</th>
                    <th style={{padding:"10px 14px", textAlign:"left", color:"#666", fontSize:11, textTransform:"uppercase"}}>Primer vrednosti</th>
                    <th style={{padding:"10px 14px", textAlign:"left", color:"#666", fontSize:11, textTransform:"uppercase"}}>Mapiraj na polje →</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map((h, i) => (
                    <tr key={i} style={{borderBottom:"1px solid #1a1a1a"}}>
                      <td style={{padding:"8px 14px", fontWeight:600, color:"#ddd", fontFamily:"monospace", fontSize:12}}>{h}</td>
                      <td style={{padding:"8px 14px", color:"#888", fontSize:12, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                        {parsed.rows[0]?.[h] || "—"}
                      </td>
                      <td style={{padding:"8px 14px"}}>
                        <select value={mapping[h] || ""} onChange={e => setMapping(prev => ({...prev, [h]: e.target.value}))}
                          style={{...inputStyle, width:"100%", fontSize:12,
                            borderColor: mapping[h] ? "#c8ff0040" : "#333",
                            color: mapping[h] ? "#c8ff00" : "#888"
                          }}>
                          {allFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <div style={{fontSize:12, color:"#888"}}>
                {Object.values(mapping).filter(Boolean).length} od {parsed.headers.length} kolona mapirano · {parsed.rows.length} redova
              </div>
              <div style={{display:"flex", gap:8}}>
                <button onClick={() => setStep(1)} style={{...btnSmall, padding:"8px 16px"}}>← Nazad</button>
                <button onClick={() => setStep(3)} disabled={!mapping.make && !Object.values(mapping).includes("make")}
                  style={{...btnPrimary, opacity: Object.values(mapping).includes("make") ? 1 : 0.5}}>
                  Preview →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Preview */}
        {step === 3 && (
          <div>
            <div style={{marginBottom:16, padding:12, background: previewCars.length > 0 ? "#c8ff0010" : "#ff6b6b10", border: `1px solid ${previewCars.length > 0 ? "#c8ff00" : "#ff6b6b"}30`, borderRadius:10}}>
              <span style={{fontSize:13, color: previewCars.length > 0 ? "#c8ff00" : "#ff6b6b", fontWeight:600}}>
                {previewCars.length > 0 ? `${previewCars.length} vozila spremno za import` : "Nijedno vozilo nije prepoznato — proveri mapiranje"}
                {parsed.rows.length - previewCars.length > 0 && ` · ${parsed.rows.length - previewCars.length} preskočeno (nedostaje marka/model)`}
              </span>
            </div>

            <div style={{background:"#111", borderRadius:10, overflow:"auto", maxHeight:300, border:"1px solid #1a1a1a", marginBottom:20}}>
              <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:"1px solid #222", position:"sticky", top:0, background:"#111"}}>
                    {["#","Marka","Model","Godina","Cena","Km","Gorivo","KS","Status"].map((h,i) => (
                      <th key={i} style={{padding:"8px 10px", textAlign:"left", color:"#555", fontSize:10, textTransform:"uppercase"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewCars.slice(0, 50).map((c, i) => (
                    <tr key={i} style={{borderBottom:"1px solid #1a1a1a"}}>
                      <td style={{padding:"6px 10px", color:"#555"}}>{i+1}</td>
                      <td style={{padding:"6px 10px", fontWeight:600, color:"#fff"}}>{c.make}</td>
                      <td style={{padding:"6px 10px", color:"#ddd"}}>{c.model}</td>
                      <td style={{padding:"6px 10px", color:"#888"}}>{c.year || "—"}</td>
                      <td style={{padding:"6px 10px", color:"#c8ff00"}}>€{c.price?.toLocaleString() || "—"}</td>
                      <td style={{padding:"6px 10px", color:"#888"}}>{c.mileage?.toLocaleString() || "—"}</td>
                      <td style={{padding:"6px 10px", color:"#888", textTransform:"capitalize"}}>{c.fuel}</td>
                      <td style={{padding:"6px 10px", color:"#888"}}>{c.hp || "—"}</td>
                      <td style={{padding:"6px 10px"}}><span style={{padding:"2px 6px", borderRadius:4, fontSize:10, background:"#c8ff0015", color:"#c8ff00"}}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewCars.length > 50 && <div style={{padding:8, textAlign:"center", color:"#555", fontSize:11}}>...i još {previewCars.length - 50} vozila</div>}
            </div>

            <div style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
              <button onClick={() => setStep(2)} style={{...btnSmall, padding:"8px 16px"}}>← Mapiranje</button>
              <button onClick={doImport} disabled={previewCars.length === 0}
                style={{...btnPrimary, padding:"10px 24px", opacity: previewCars.length > 0 ? 1 : 0.5}}>
                Importuj {previewCars.length} vozila
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === 4 && importResult && (
          <div style={{textAlign:"center", padding:20}}>
            <div style={{width:48, height:48, borderRadius:"50%", background:"#c8ff0020", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", color:"#c8ff00"}}>{Icons.check}</div>
            <h3 style={{fontSize:20, fontWeight:700, color:"#fff", marginBottom:8}}>Import završen!</h3>
            <p style={{fontSize:14, color:"#888", marginBottom:24}}>
              Importovano <span style={{color:"#c8ff00", fontWeight:700}}>{importResult.imported}</span> vozila od ukupno {importResult.total} redova.
              {importResult.skipped > 0 && <span style={{color:"#ff6b6b"}}> {importResult.skipped} preskočeno.</span>}
            </p>
            <button onClick={onClose} style={{...btnPrimary, margin:"0 auto"}}>Zatvori</button>
          </div>
        )}
      </div>
    </div>
  );
}


function DealerStorefront({ dealer, cars, onBack, isPublic }) {
  const [view, setView] = useState("welcome"); // welcome | browse | detail | compare
  const [selectedCar, setSelectedCar] = useState(null);
  const [compareCar, setCompareCar] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [welcomeInput, setWelcomeInput] = useState("");
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [showTestDrive, setShowTestDrive] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const [lang, setLang] = useState("en");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId] = useState(`chat-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  const chatEndRef = useRef(null);
  const dealerCars = cars.filter(c => c.dealerId === dealer.id);
  const accent = dealer.accent || "#c8ff00";

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Build inventory context for AI
  const buildInventoryContext = () => {
    const available = dealerCars.filter(c => c.status === "available");
    return available.map(c => 
      `${c.make} ${c.model} ${c.trim||""} (${c.year||"N/A"}) - €${c.price?.toLocaleString()} - ${c.mileage?.toLocaleString()}km - ${c.fuel} - ${c.transmission} - ${c.hp}hp - ${c.color} - ID:${c.id}`
    ).join("\n");
  };

  // Send message to webhook or use local fallback
  const sendToAI = async (userMessage, isWelcome = false) => {
    setChatLoading(true);
    const webhookUrl = dealer.chatWebhook;
    
    if (webhookUrl) {
      // ── Real webhook call ──
      try {
        const payload = {
          sessionId: chatSessionId,
          dealerId: dealer.id,
          dealerName: dealer.name,
          language: lang,
          message: userMessage,
          selectedCar: selectedCar ? { id: selectedCar.id, make: selectedCar.make, model: selectedCar.model, price: selectedCar.price } : null,
          inventory: buildInventoryContext(),
          chatHistory: chatMessages.slice(-10).map(m => ({ role: m.role, text: m.text })),
        };

        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        // Handle response — support multiple formats
        const aiText = data.text || data.message || data.response || data.output || 
                       (typeof data === "string" ? data : JSON.stringify(data));

        setChatMessages(prev => [...prev, { role: "assistant", text: aiText, time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) }]);

        // If response includes car recommendations (IDs)
        if (data.carIds && Array.isArray(data.carIds)) {
          const recommended = data.carIds.map(id => dealerCars.find(c => c.id === id)).filter(Boolean);
          if (recommended.length > 0) {
            setSelectedCar(recommended[0]);
            if (recommended.length > 1) setCompareCar(recommended[1]);
          }
        }
        // If response includes action
        if (data.action === "showSpecs" && selectedCar) setShowSpecs(true);
        if (data.action === "bookTestDrive" && selectedCar) setShowTestDrive(true);

      } catch (err) {
        console.error("Webhook error:", err);
        setChatMessages(prev => [...prev, { 
          role: "assistant", 
          text: "Izvinite, trenutno imam problem sa konekcijom. Pokušajte ponovo za trenutak.", 
          time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),
          isError: true 
        }]);
      }
    } else {
      // ── Local smart fallback (no webhook configured) ──
      await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
      
      const q = userMessage.toLowerCase();
      const available = dealerCars.filter(c => c.status === "available");
      let reply = "";
      let matchedCars = [];

      // Price-based search
      const priceMatch = q.match(/(\d[\d.,]*)\s*(eur|€|euro|hiljad|k\b)/i) || q.match(/(za|under|do|bis|pod)\s*(\d[\d.,]*)/i);
      if (priceMatch) {
        const budget = parseFloat((priceMatch[2]||priceMatch[1]).replace(/[.,]/g,"")) * (q.includes("k") || q.includes("hiljad") ? 1000 : 1);
        matchedCars = available.filter(c => c.price <= budget).sort((a,b) => b.price - a.price);
      }
      
      // Make/model search
      const makes = [...new Set(available.map(c => c.make.toLowerCase()))];
      const foundMake = makes.find(m => q.includes(m));
      if (foundMake) {
        matchedCars = available.filter(c => c.make.toLowerCase() === foundMake);
      }

      // Fuel type search
      if (/diesel|dizel/i.test(q)) matchedCars = available.filter(c => c.fuel === "diesel");
      if (/benzin|gasoline|petrol/i.test(q)) matchedCars = available.filter(c => c.fuel === "gasoline");
      if (/hybrid|hibrid/i.test(q)) matchedCars = available.filter(c => c.fuel === "hybrid");
      if (/elektr|electric/i.test(q)) matchedCars = available.filter(c => c.fuel === "electric");

      // Body type
      if (/suv|džip|jeep/i.test(q)) matchedCars = available.filter(c => /suv/i.test(c.bodyType));
      if (/sedan|limuzin/i.test(q)) matchedCars = available.filter(c => /sedan/i.test(c.bodyType));

      // Family / space
      if (/famil|porodic|family|kinder|deca|djeca/i.test(q)) {
        matchedCars = available.filter(c => /suv|wagon|van|kombi/i.test(c.bodyType) || c.drivetrain === "AWD");
      }

      // Test drive / booking
      if (/test|drive|prob|vožn|termin|zakaž|book|besichtig/i.test(q)) {
        if (selectedCar) {
          setShowTestDrive(true);
          reply = `I'd be happy to help you book a test drive for the ${selectedCar.make} ${selectedCar.model}! I've opened the booking form for you.`;
        } else {
          reply = "Which vehicle would you like to test drive? Select one from the list first, then I can help you book.";
        }
      }

      // Specs / details
      if (/spec|detail|info|podatk|characteristic|übersicht/i.test(q)) {
        if (selectedCar) {
          setShowSpecs(true);
          reply = `Here are the full specs for the ${selectedCar.make} ${selectedCar.model}. I've opened the overview panel for you.`;
        } else {
          reply = "Select a vehicle first and I'll show you all the details!";
        }
      }

      // Compare
      if (/compar|poredi|vergleich|razlik|differ/i.test(q) && selectedCar && compareCar) {
        reply = `Comparing the ${selectedCar.make} ${selectedCar.model} (€${selectedCar.price?.toLocaleString()}, ${selectedCar.hp}hp) with the ${compareCar.make} ${compareCar.model} (€${compareCar.price?.toLocaleString()}, ${compareCar.hp}hp). The ${selectedCar.price > compareCar.price ? compareCar.make : selectedCar.make} offers better value, while the ${selectedCar.hp > compareCar.hp ? selectedCar.make : compareCar.make} has more power.`;
      }

      if (!reply && matchedCars.length > 0) {
        const top = matchedCars.slice(0, 3);
        if (top.length === 1) {
          reply = `I found the perfect match: **${top[0].make} ${top[0].model}** (${top[0].year}) for **€${top[0].price?.toLocaleString()}** — ${top[0].mileage?.toLocaleString()}km, ${top[0].fuel}, ${top[0].hp}hp. Would you like to see the full specs or book a test drive?`;
        } else {
          reply = `Great options for you:\n\n${top.map((c,i) => `${i+1}. **${c.make} ${c.model}** (${c.year}) — €${c.price?.toLocaleString()}, ${c.mileage?.toLocaleString()}km, ${c.fuel}`).join("\n")}\n\nWould you like details on any of these?`;
        }
        setSelectedCar(top[0]);
        if (top.length > 1) setCompareCar(top[1]);
      }

      if (!reply && !matchedCars.length) {
        if (isWelcome || chatMessages.length === 0) {
          if (available.length > 0) {
            const top = available.slice(0, 2);
            reply = `Welcome to ${dealer.name}! We have ${available.length} vehicles available. Here are some highlights:\n\n${top.map(c => `• **${c.make} ${c.model}** — €${c.price?.toLocaleString()}`).join("\n")}\n\nWhat are you looking for? I can filter by price, make, fuel type, or body style.`;
            setSelectedCar(top[0]);
            if (top.length > 1) setCompareCar(top[1]);
          } else {
            reply = `Welcome to ${dealer.name}! How can I help you today?`;
          }
        } else {
          reply = `I have ${available.length} vehicles in stock. You can ask me about:\n• Price range (e.g. "what can I get for €20,000")\n• Specific makes (e.g. "show me BMW")\n• Fuel type (e.g. "diesel cars")\n• Body style (e.g. "SUV for family")\n• Or ask to book a test drive!`;
        }
      }

      setChatMessages(prev => [...prev, { role: "assistant", text: reply, time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) }]);
    }
    
    setChatLoading(false);
  };

  const handleWelcomeSubmit = () => {
    if (!welcomeInput.trim()) return;
    const msg = welcomeInput;
    setChatMessages([{ role:"user", text: msg, time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) }]);
    setChatOpen(true);
    setView("browse");
    setWelcomeInput("");
    sendToAI(msg, true);
  };

  const handleChatSend = () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput;
    setChatMessages(prev => [...prev, { role:"user", text: msg, time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) }]);
    setChatInput("");
    sendToAI(msg);
  };

  const selectCar = (car) => {
    if (selectedCar && selectedCar.id !== car.id) setCompareCar(car);
    setSelectedCar(car);
    setCurrentImageIdx(0);
  };

  return (
    <div style={{height:"100vh", display:"flex", flexDirection:"column", background:"#0f0f0d", color:"#f0ece4", fontFamily:"'Inter',sans-serif", overflow:"hidden", position:"relative"}}>
      {/* Back to admin button */}
      <button onClick={onBack} style={{position:"fixed", top:12, left:12, zIndex:200, background:"#000a", border:"1px solid #333", borderRadius:8, padding:"6px 12px", color:"#999", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:6, backdropFilter:"blur(8px)"}}>
        {Icons.back} {isPublic ? "Sve autokuće" : "Admin"}
      </button>

      {/* ═══ WELCOME SCREEN ═══ */}
      {view === "welcome" && (
        <div style={{
          position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          gap:"2rem", zIndex:100, padding:"2rem",
          background: `linear-gradient(to bottom, rgba(15,15,13,${(dealer.bgOverlayOpacity||0.7)*0.7}), rgba(15,15,13,${dealer.bgOverlayOpacity||0.7})), url('${dealer.bgImage || "https://picsum.photos/seed/dealership/1600/900"}') center/cover no-repeat`
        }}>
          {/* Language switcher */}
          <div style={{position:"absolute", top:28, right:28, display:"flex", alignItems:"center", gap:8}}>
            {Icons.globe}
            <select value={lang} onChange={e=>setLang(e.target.value)} style={{background:"#0008", border:"1px solid #444", borderRadius:6, color:"#fff", padding:"4px 8px", fontSize:12}}>
              {(dealer.languages||["en"]).map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select>
          </div>

          {/* Avatar */}
          {dealer.avatarImage ? (
            <div style={{width:96, height:96, borderRadius:"50%", overflow:"hidden", border:`3px solid ${accent}50`, boxShadow:`0 0 30px ${accent}20`}}>
              <Img src={dealer.avatarImage} alt={dealer.avatarName||""} style={{width:"100%", height:"100%", objectFit:"cover"}} />
            </div>
          ) : (
            <div style={{width:96, height:96, borderRadius:"50%", background:`linear-gradient(135deg, ${accent}30, ${accent}10)`, border:`2px solid ${accent}50`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, fontWeight:700, color:accent}}>
              {dealer.avatarName?.[0] || dealer.logo?.[0] || "?"}
            </div>
          )}

          {/* Headline */}
          <div style={{textAlign:"center"}}>
            <h1 style={{fontSize:"clamp(1.5rem,4vw,2.5rem)", fontWeight:300, color:"#f0ece4cc", margin:0}}>
              {dealer.welcomeSubline || "Hello, ready to find your"}
            </h1>
            <h1 style={{fontSize:"clamp(1.8rem,4.5vw,3rem)", fontWeight:700, color:"#fff", margin:"0.25rem 0"}}>
              {dealer.welcomeHeadline || "Dream Machine?"}
            </h1>
          </div>

          {/* Search input */}
          <div style={{display:"flex", alignItems:"center", gap:12, width:"100%", maxWidth:560}}>
            <input value={welcomeInput} onChange={e=>setWelcomeInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleWelcomeSubmit()}
              placeholder="hi what can i get for 20000..."
              style={{flex:1, background:"#ffffff12", border:"1px solid #ffffff20", borderRadius:28, padding:"14px 24px", color:"#fff", fontSize:15, outline:"none"}} />
            <button onClick={handleWelcomeSubmit}
              style={{width:48, height:48, borderRadius:"50%", background:accent, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#000", flexShrink:0}}>
              {Icons.send}
            </button>
          </div>

          {/* Logo */}
          <div style={{marginTop:16, display:"flex", alignItems:"center", gap:12}}>
            {dealer.logoImage ? (
              <Img src={dealer.logoImage} alt={dealer.name} style={{height:48, objectFit:"contain"}} />
            ) : (
              <>
                <span style={{fontSize:32, fontWeight:800, color:accent}}>{dealer.logo}</span>
                <span style={{fontSize:24, fontWeight:300, letterSpacing:4, textTransform:"uppercase", color:"#fff"}}>{dealer.name?.replace(dealer.logo,"").trim() || "MOTORS"}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ BROWSE VIEW (3-column layout) ═══ */}
      {view === "browse" && (
        <div style={{display:"flex", height:"100vh", overflow:"hidden"}}>
          {/* LEFT SIDEBAR */}
          <div style={{width:280, background:"#111110", borderRight:"1px solid #ffffff0a", display:"flex", flexDirection:"column", overflow:"auto", flexShrink:0}}>
            <button onClick={() => setView("welcome")} style={{padding:"14px 16px", background:"none", border:"none", borderBottom:"1px solid #ffffff08", color:"#888", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:8, textAlign:"left"}}>
              {Icons.home} Back to {dealer.name}
            </button>

            {/* Current Search */}
            <div style={{padding:16}}>
              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
                <span style={{color:accent}}>{Icons.search}</span>
                <span style={{fontSize:12, fontWeight:700, letterSpacing:1, textTransform:"uppercase"}}>Current Search</span>
              </div>
              {dealerCars.filter(c => c.status === "available").slice(0, 4).map(c => (
                <button key={c.id} onClick={() => selectCar(c)}
                  style={{
                    width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 8px",
                    background: selectedCar?.id === c.id ? `${accent}12` : "transparent",
                    border: selectedCar?.id === c.id ? `1px solid ${accent}30` : "1px solid transparent",
                    borderRadius:10, cursor:"pointer", color:"#fff", textAlign:"left", marginBottom:4
                  }}>
                  <div style={{width:40, height:30, borderRadius:6, background:"#222", overflow:"hidden", flexShrink:0}}>
                    {(c.media||c.images?.map(u=>({type:"image",url:u}))||[]).find(m=>m.type==="image")?.url && 
                      <Img src={(c.media||c.images?.map(u=>({type:"image",url:u}))||[]).find(m=>m.type==="image").url} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}} />}
                  </div>
                  <div>
                    <div style={{fontSize:13, fontWeight:600}}>{c.make.toLowerCase()} {c.model.toLowerCase()}</div>
                    <div style={{fontSize:11, color:"#666"}}>€{c.price?.toLocaleString()}</div>
                  </div>
                  {selectedCar?.id === c.id && <span style={{marginLeft:"auto", color:accent, fontSize:10}}>●</span>}
                </button>
              ))}
            </div>

            {/* Recent Searches */}
            <div style={{padding:"0 16px 16px"}}>
              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
                <span style={{color:"#ff6b6b"}}>{Icons.clock}</span>
                <span style={{fontSize:12, fontWeight:700, letterSpacing:1, textTransform:"uppercase"}}>Recent Searches</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{padding:"0 16px 16px"}}>
              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
                <span style={{color:accent}}>{Icons.zap}</span>
                <span style={{fontSize:12, fontWeight:700, letterSpacing:1, textTransform:"uppercase"}}>Quick Actions</span>
              </div>
              <button onClick={() => setShowSpecs(true)} style={{...quickActionBtn}}>{Icons.fileText} View Full Specs</button>
              <button onClick={() => setShowTestDrive(true)} style={{...quickActionBtn}}>{Icons.globe} Book Test Drive</button>
            </div>

            <div style={{marginTop:"auto", padding:16, fontSize:11, color:"#444"}}>
              Powered by {dealer.name}
            </div>
          </div>

          {/* CENTER - Vehicle Display */}
          <div style={{flex:1, position:"relative", background:"#0a0a08", display:"flex", flexDirection:"column"}}>
            {selectedCar ? (
              <>
                {/* Main Image */}
                <div style={{flex:1, position:"relative", overflow:"hidden"}}>
                  {/* Dealer logo watermark */}
                  <div style={{position:"absolute", top:20, left:20, zIndex:10, opacity:0.6}}>
                    {dealer.logoImage ? (
                      <Img src={dealer.logoImage} alt={dealer.name} style={{height:36, objectFit:"contain"}} />
                    ) : (
                      <>
                        <span style={{fontSize:36, fontWeight:800, color:accent}}>{dealer.logo}</span>
                        <span style={{fontSize:24, fontWeight:300, color:"#fff", marginLeft:8, letterSpacing:3}}>{dealer.name?.replace(dealer.logo,"").trim()}</span>
                      </>
                    )}
                  </div>

                  {(() => {
                    const mediaList = selectedCar.media || selectedCar.images?.map(u=>({type:"image",url:u})) || [];
                    const current = mediaList[currentImageIdx];
                    if (!current) return <div style={{width:"100%",height:"100%",background:"#111",display:"flex",alignItems:"center",justifyContent:"center",color:"#444"}}>No media</div>;
                    if (current.type === "video") {
                      // Check if it's a YouTube/Vimeo embed URL or a direct video file
                      const isEmbed = /youtube|youtu\.be|vimeo/.test(current.url);
                      if (isEmbed) {
                        return <iframe src={current.url} title="Vehicle video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
                          style={{width:"100%", height:"100%", border:"none"}} />;
                      }
                      return <video src={current.url} controls autoPlay style={{width:"100%", height:"100%", objectFit:"cover", background:"#000"}} />;
                    }
                    return <Img src={current.url} alt={`${selectedCar.make} ${selectedCar.model}`} style={{width:"100%", height:"100%", objectFit:"cover"}} />;
                  })()}

                  {/* Thumbnails */}
                  <div style={{position:"absolute", right:16, top:"50%", transform:"translateY(-50%)", display:"flex", flexDirection:"column", gap:8}}>
                    {(selectedCar.media || selectedCar.images?.map(u=>({type:"image",url:u})) || []).map((m, i) => (
                      <button key={i} onClick={() => setCurrentImageIdx(i)}
                        style={{width:56, height:42, borderRadius:8, overflow:"hidden", border: i===currentImageIdx ? `2px solid ${accent}` : "2px solid #333", cursor:"pointer", padding:0, position:"relative", background:"#222"}}>
                        {m.type === "video" ? (
                          <div style={{width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background:"#1a1a1a"}}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill={accent} stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </div>
                        ) : (
                          <Img src={m.url} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info Card */}
                <div style={{position:"absolute", bottom:80, left:24, background:"#1a1a18ee", backdropFilter:"blur(16px)", borderRadius:16, padding:24, maxWidth:340, border:"1px solid #ffffff10"}}>
                  <h2 style={{fontSize:28, fontWeight:700, color:"#fff", lineHeight:1.1, margin:0}}>
                    {selectedCar.make.toLowerCase()} {selectedCar.model.toLowerCase()}
                  </h2>
                  <p style={{fontSize:13, color:"#888", margin:"8px 0 16px"}}>{selectedCar.trim}</p>
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 24px", fontSize:13, color:"#aaa", marginBottom:16}}>
                    <div style={{display:"flex", alignItems:"center", gap:6}}>{Icons.calendar} {selectedCar.year || "N/A"}</div>
                    <div style={{display:"flex", alignItems:"center", gap:6}}>{Icons.road} {selectedCar.mileage?.toLocaleString()} km</div>
                    <div style={{display:"flex", alignItems:"center", gap:6}}>{Icons.gearbox} {selectedCar.transmission}</div>
                    <div style={{display:"flex", alignItems:"center", gap:6}}>{Icons.fuelPump} {selectedCar.fuel}</div>
                  </div>
                  <div style={{fontSize:32, fontWeight:700, color:accent}}>€{selectedCar.price?.toLocaleString()}</div>
                </div>

                {/* Vehicle Overview button */}
                <div style={{position:"absolute", bottom:24, right:24}}>
                  <button onClick={() => setShowSpecs(true)}
                    style={{background:"#222", border:"1px solid #333", borderRadius:12, padding:"10px 20px", color:"#fff", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:8}}>
                    {Icons.fileText} Vehicle Overview →
                  </button>
                </div>

                {/* Volume slider mock */}
                <div style={{position:"absolute", bottom:24, left:"50%", transform:"translateX(-50%)", display:"flex", alignItems:"center", gap:12, background:"#1a1a18cc", borderRadius:20, padding:"6px 16px"}}>
                  {Icons.volume}
                  <div style={{width:120, height:3, background:"#333", borderRadius:2, position:"relative"}}>
                    <div style={{width:"70%", height:"100%", background:`linear-gradient(90deg, ${accent}, #ff6b6b)`, borderRadius:2}} />
                  </div>
                  <span style={{fontSize:12, color:"#888"}}>24</span>
                </div>
              </>
            ) : (
              <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#444"}}>
                Izaberi vozilo iz liste
              </div>
            )}
          </div>

          {/* RIGHT - Chat Panel */}
          <div style={{width:320, background:"#111110", borderLeft:"1px solid #ffffff0a", display:"flex", flexDirection:"column", flexShrink:0}}>
            {/* Dealer header */}
            <div style={{padding:16, borderBottom:"1px solid #ffffff08", position:"relative"}}>
              <div style={{width:"100%", height:100, borderRadius:12, overflow:"hidden", marginBottom:12, position:"relative"}}>
                {dealer.chatHeaderImage ? (
                  <Img src={dealer.chatHeaderImage} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}} />
                ) : dealer.avatarImage ? (
                  <div style={{width:"100%", height:"100%", position:"relative"}}>
                    <div style={{position:"absolute", inset:0, background:`linear-gradient(135deg, ${accent}30, #0a0a0a)`}} />
                    <Img src={dealer.avatarImage} alt="" style={{width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top", opacity:0.5}} />
                    <div style={{position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center"}}>
                      {dealer.logoImage ? <Img src={dealer.logoImage} style={{height:32}} /> : (
                        <><span style={{fontSize:28, fontWeight:800, color:accent}}>{dealer.logo}</span>
                        <span style={{fontSize:18, fontWeight:300, color:"#fff", marginLeft:8, letterSpacing:2}}>{dealer.name?.replace(dealer.logo,"").trim()}</span></>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{width:"100%", height:"100%", background:`linear-gradient(135deg, ${accent}30, #0a0a0a)`, display:"flex", alignItems:"center", justifyContent:"center"}}>
                    <span style={{fontSize:28, fontWeight:800, color:accent}}>{dealer.logo}</span>
                    <span style={{fontSize:18, fontWeight:300, color:"#fff", marginLeft:8, letterSpacing:2}}>{dealer.name?.replace(dealer.logo,"").trim()}</span>
                  </div>
                )}
              </div>
              <div style={{display:"flex", gap:8}}>
                <button style={{...langBtn, background: lang==="en" ? accent : "#222", color: lang==="en" ? "#000" : "#888"}} onClick={()=>setLang("en")}>{Icons.globe} EN</button>
                <button style={{...langBtn}} onClick={()=>{}}>{Icons.volume}</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{flex:1, overflow:"auto", padding:16, display:"flex", flexDirection:"column", gap:12}}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{display:"flex", flexDirection:"column", alignItems: m.role==="user" ? "flex-end" : "flex-start"}}>
                  {m.role === "assistant" && (
                    dealer.avatarImage ? (
                      <div style={{width:28, height:28, borderRadius:"50%", overflow:"hidden", marginBottom:4, flexShrink:0}}>
                        <Img src={dealer.avatarImage} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}} />
                      </div>
                    ) : (
                      <div style={{width:28, height:28, borderRadius:"50%", background:"#222", marginBottom:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:accent, flexShrink:0}}>
                        {dealer.avatarName?.[0] || "A"}
                      </div>
                    )
                  )}
                  <div style={{
                    maxWidth:"85%", padding:"10px 14px", borderRadius:14, fontSize:13, lineHeight:1.6,
                    background: m.role==="user" ? accent : m.isError ? "#ff6b6b15" : "#1e1e1a",
                    color: m.role==="user" ? "#000" : m.isError ? "#ff6b6b" : "#ddd",
                    borderBottomRightRadius: m.role==="user" ? 4 : 14,
                    borderBottomLeftRadius: m.role==="assistant" ? 4 : 14,
                    whiteSpace:"pre-wrap",
                  }}
                    dangerouslySetInnerHTML={{__html: m.text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
                  />
                  <span style={{fontSize:10, color:"#555", marginTop:4}}>{m.time}</span>
                </div>
              ))}
              {chatLoading && (
                <div style={{display:"flex", alignItems:"center", gap:8, color:"#888", fontSize:13}}>
                  <div style={{display:"flex", gap:3}}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{width:6, height:6, borderRadius:"50%", background:accent, opacity:0.6,
                        animation:`pulse 1s ease-in-out ${i*0.15}s infinite`}} />
                    ))}
                  </div>
                  <span style={{fontSize:12, color:"#555"}}>Razmišljam...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div style={{padding:12, borderTop:"1px solid #ffffff08"}}>
              <div style={{display:"flex", gap:8}}>
                <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleChatSend()}
                  placeholder={chatLoading ? "Čekam odgovor..." : "Ask about this vehicle..."}
                  disabled={chatLoading}
                  style={{flex:1, background:"#1a1a18", border:"1px solid #ffffff10", borderRadius:20, padding:"10px 16px", color:"#fff", fontSize:13, outline:"none", opacity: chatLoading ? 0.5 : 1}} />
                <button onClick={handleChatSend} disabled={chatLoading}
                  style={{width:36, height:36, borderRadius:"50%", background: chatLoading ? "#1a1a1a" : accent, border:"none", cursor: chatLoading ? "wait" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", color: chatLoading ? "#555" : "#000", transition:"all 0.15s"}}>
                  {Icons.send}
                </button>
              </div>
            </div>
            <style>{`@keyframes pulse { 0%,100% { transform:scale(1); opacity:0.4 } 50% { transform:scale(1.3); opacity:1 } }`}</style>
          </div>
        </div>
      )}

      {/* ═══ VEHICLE OVERVIEW MODAL ═══ */}
      {showSpecs && selectedCar && (
        <div style={{position:"fixed", inset:0, background:"#000c", zIndex:300, display:"flex", justifyContent:"flex-end"}}>
          <div style={{width:420, background:"#151514", height:"100%", overflow:"auto", padding:24, borderLeft:"1px solid #222"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
              <h2 style={{fontSize:18, fontWeight:700, display:"flex", alignItems:"center", gap:8}}>{Icons.fileText} Vehicle Overview</h2>
              <button onClick={()=>setShowSpecs(false)} style={{background:"#222", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", color:"#888", display:"flex", alignItems:"center", justifyContent:"center"}}>{Icons.close}</button>
            </div>

            <SpecSection title="General Overview" icon={Icons.info} items={[
              ["Make", selectedCar.make],
              ["Model", selectedCar.model],
              ["Trim", selectedCar.trim],
              ["Body Type", selectedCar.bodyType],
              ["Price", `${selectedCar.price?.toLocaleString()} EUR`],
              ["Mileage", `${selectedCar.mileage?.toLocaleString()} km`],
              ["Condition", selectedCar.condition],
              ["Status", selectedCar.status],
              ["Seller Type", "Dealer"],
            ]} accent={accent} />

            <SpecSection title="Engine & Performance" icon={Icons.wrench} items={[
              ["Fuel Type", selectedCar.fuel],
              ["Transmission", selectedCar.transmission],
              ["Drivetrain", selectedCar.drivetrain],
              ["Engine Capacity", `${selectedCar.engineCC} cc`],
              ["Horsepower", `${selectedCar.hp} hp`],
            ]} accent={accent} />

            <SpecSection title="Exterior & Interior" icon={Icons.palette} items={[
              ["Exterior Color", selectedCar.color],
            ]} accent={accent} />

            {selectedCar.features?.length > 0 && (
              <div style={{marginTop:16}}>
                <h3 style={{fontSize:14, fontWeight:600, marginBottom:12, display:"flex", alignItems:"center", gap:8}}>
                  <span style={{color:accent}}>{Icons.star}</span> Features
                </h3>
                <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                  {selectedCar.features.map((f,i) => (
                    <span key={i} style={{padding:"4px 10px", background:"#222", borderRadius:6, fontSize:12, color:"#ccc"}}>{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TEST DRIVE MODAL ═══ */}
      {showTestDrive && selectedCar && (
        <div style={{position:"fixed", inset:0, background:"#000c", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center"}}>
          <div style={{background:"#1a1a18", borderRadius:20, padding:32, width:420, border:"1px solid #ffffff10"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
              <h2 style={{fontSize:18, fontWeight:700, display:"flex", alignItems:"center", gap:8}}>{Icons.globe} Book Test Drive</h2>
              <button onClick={()=>setShowTestDrive(false)} style={{background:"#222", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", color:"#888", display:"flex", alignItems:"center", justifyContent:"center"}}>{Icons.close}</button>
            </div>
            <div style={{background:`${accent}10`, border:`1px solid ${accent}30`, borderRadius:12, padding:14, marginBottom:20}}>
              <div style={{fontSize:11, color:accent, fontWeight:600, textTransform:"uppercase", letterSpacing:1}}>Selected Vehicle</div>
              <div style={{fontSize:14, fontWeight:600, color:"#fff", marginTop:4}}>{selectedCar.make} {selectedCar.model} — {selectedCar.trim}. {selectedCar.year || "N/A"}</div>
            </div>
            <div style={{display:"grid", gap:16}}>
              <div>
                <label style={{fontSize:12, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block"}}>Email Address</label>
                <input placeholder="your@email.com" style={{...inputStyleLight}} />
              </div>
              <div>
                <label style={{fontSize:12, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block"}}>Contact Number</label>
                <input placeholder="+43 000 0000000" style={{...inputStyleLight}} />
              </div>
              <div>
                <label style={{fontSize:12, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block"}}>Test Drive Location</label>
                <select style={{...inputStyleLight}}>
                  <option value="">Select a location...</option>
                  {(dealer.locations || []).map((l,i) => <option key={i} value={l}>{l}</option>)}
                </select>
              </div>
              <button style={{width:"100%", padding:"14px", background:accent, color:"#000", border:"none", borderRadius:12, fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8}}>
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SpecSection({ title, icon, items, accent }) {
  return (
    <div style={{marginBottom:16}}>
      <h3 style={{fontSize:14, fontWeight:600, marginBottom:12, display:"flex", alignItems:"center", gap:8, textTransform:"uppercase", letterSpacing:1}}>
        <span style={{color:accent}}>{icon}</span> {title}
      </h3>
      <div style={{background:"#1a1a18", borderRadius:12, overflow:"hidden"}}>
        {items.map(([k, v], i) => (
          <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"10px 14px", borderBottom: i < items.length-1 ? "1px solid #ffffff06" : "none"}}>
            <span style={{color:"#888", fontSize:13}}>{k}</span>
            <span style={{fontWeight:600, fontSize:13, textTransform:"capitalize"}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupName, setSetupName] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Unesi email i lozinku"); return; }
    setLoading(true); setError("");
    
    // Try API auth first
    if (API_AVAILABLE) {
      try {
        const data = await API.login(email, password);
        if (data.token) {
          API.token = data.token;
          const session = { ...data.user, token: data.token, loggedInAt: new Date().toISOString() };
          await DB.set("autohouse-session", session);
          onLogin(session);
          setLoading(false);
          return;
        }
      } catch (e) {
        // If API returned auth error, show it
        if (e.message.includes("Invalid") || e.message.includes("credentials")) {
          setError("Pogrešan email ili lozinka");
          setLoading(false);
          return;
        }
        // Otherwise fall through to local auth
        console.warn("API login failed, trying local:", e.message);
      }
    }
    
    // Fallback: local auth
    try {
      const users = await DB.get("autohouse-users") || [];
      const user = users.find(u => u.email === email);
      
      if (!user) {
        if (users.length === 0) { setShowSetup(true); setLoading(false); return; }
        setError("Pogrešan email ili lozinka");
        setLoading(false);
        return;
      }
      
      if (user.password !== password) {
        setError("Pogrešan email ili lozinka");
        setLoading(false);
        return;
      }

      const session = { userId: user.id, email: user.email, name: user.name, role: user.role, dealerId: user.dealerId, loggedInAt: new Date().toISOString() };
      await DB.set("autohouse-session", session);
      onLogin(session);
    } catch (e) {
      setError("Greška pri prijavi");
    }
    setLoading(false);
  };

  const handleSetup = async () => {
    if (!email || !password) { setError("Unesi email i lozinku"); return; }
    setLoading(true);
    
    // Try API register first
    if (API_AVAILABLE) {
      try {
        const data = await API.register({ email, password, name: setupName || "Admin", role: "admin" });
        if (data.token) {
          API.token = data.token;
          const session = { ...data.user, token: data.token, loggedInAt: new Date().toISOString() };
          await DB.set("autohouse-session", session);
          onLogin(session);
          setLoading(false);
          return;
        }
      } catch (e) { console.warn("API register failed, using local:", e.message); }
    }

    // Fallback local
    const user = { id: `user-${Date.now()}`, email, password, name: setupName || "Admin", role: "admin", dealerId: null };
    await DB.set("autohouse-users", [user]);
    const session = { userId: user.id, email, name: user.name, role: "admin", loggedInAt: new Date().toISOString() };
    await DB.set("autohouse-session", session);
    onLogin(session);
    setLoading(false);
  };

  return (
    <div style={{height:"100vh", display:"flex", fontFamily:"'Inter',system-ui,sans-serif", background:"#0a0a0a"}}>
      {/* Left side — branding */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 80px",
        background:"linear-gradient(135deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)",
        position:"relative", overflow:"hidden"
      }}>
        {/* Subtle grid pattern */}
        <div style={{position:"absolute", inset:0, opacity:0.03, 
          backgroundImage:"linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize:"60px 60px"}} />
        
        <div style={{position:"relative", zIndex:1}}>
          <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:40}}>
            <div style={{width:48, height:48, borderRadius:12, background:"#c8ff0015", border:"1px solid #c8ff0030", display:"flex", alignItems:"center", justifyContent:"center"}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c8ff00" strokeWidth="2" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a1 1 0 011-1l3-3h10l3 3a1 1 0 011 1v6a2 2 0 01-2 2M5 17a2 2 0 002 2h1a2 2 0 002-2M14 17a2 2 0 002 2h1a2 2 0 002-2"/></svg>
            </div>
            <div>
              <div style={{fontSize:20, fontWeight:700, color:"#fff", letterSpacing:1}}>AutoHouse</div>
              <div style={{fontSize:11, color:"#555", letterSpacing:2, textTransform:"uppercase"}}>Dealer Platform</div>
            </div>
          </div>
          
          <h1 style={{fontSize:44, fontWeight:700, color:"#fff", lineHeight:1.15, marginBottom:16}}>
            Upravljaj svim<br/>
            <span style={{color:"#c8ff00"}}>autokućama</span> sa<br/>
            jednog mesta.
          </h1>
          <p style={{fontSize:16, color:"#666", lineHeight:1.7, maxWidth:420}}>
            Kreiraj autokuće, dodaj vozila, podesi brending i AI chat — sve kroz jedan admin panel.
          </p>
          
          <div style={{marginTop:48, display:"flex", gap:24}}>
            {[
              {n:"50+", l:"Autokuća"},
              {n:"10k+", l:"Vozila"},
              {n:"3", l:"Jezika"},
            ].map((s,i) => (
              <div key={i}>
                <div style={{fontSize:28, fontWeight:700, color:"#c8ff00"}}>{s.n}</div>
                <div style={{fontSize:12, color:"#555", marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side — login form */}
      <div style={{width:480, display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 60px", borderLeft:"1px solid #ffffff08"}}>
        <div style={{marginBottom:32}}>
          <h2 style={{fontSize:24, fontWeight:700, color:"#fff", marginBottom:8}}>
            {showSetup ? "Postavi admin nalog" : "Prijavi se"}
          </h2>
          <p style={{fontSize:14, color:"#666"}}>
            {showSetup ? "Ovo je prvi put — kreiraj admin pristup." : "Pristupi svom admin panelu."}
          </p>
        </div>

        {showSetup && (
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12, fontWeight:600, color:"#555", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block"}}>Tvoje ime</label>
            <input value={setupName} onChange={e=>setSetupName(e.target.value)} placeholder="npr. Dejan"
              style={{width:"100%", background:"#111", border:"1px solid #222", borderRadius:10, padding:"12px 16px", color:"#fff", fontSize:14, outline:"none"}} />
          </div>
        )}

        <div style={{marginBottom:16}}>
          <label style={{fontSize:12, fontWeight:600, color:"#555", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block"}}>Email</label>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#444"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
            </span>
            <input value={email} onChange={e=>{setEmail(e.target.value);setError("")}}
              onKeyDown={e => e.key === "Enter" && (showSetup ? handleSetup() : handleLogin())}
              placeholder="admin@autohouse.com" type="email"
              style={{width:"100%", background:"#111", border:"1px solid #222", borderRadius:10, padding:"12px 16px 12px 42px", color:"#fff", fontSize:14, outline:"none"}} />
          </div>
        </div>

        <div style={{marginBottom:8}}>
          <label style={{fontSize:12, fontWeight:600, color:"#555", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block"}}>Lozinka</label>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#444"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </span>
            <input value={password} onChange={e=>{setPassword(e.target.value);setError("")}}
              onKeyDown={e => e.key === "Enter" && (showSetup ? handleSetup() : handleLogin())}
              placeholder="••••••••" type="password"
              style={{width:"100%", background:"#111", border:"1px solid #222", borderRadius:10, padding:"12px 16px 12px 42px", color:"#fff", fontSize:14, outline:"none"}} />
          </div>
        </div>

        {error && (
          <div style={{padding:"10px 14px", background:"#ff6b6b15", border:"1px solid #ff6b6b30", borderRadius:8, marginBottom:12, marginTop:8}}>
            <span style={{fontSize:13, color:"#ff6b6b"}}>{error}</span>
          </div>
        )}

        <button onClick={showSetup ? handleSetup : handleLogin} disabled={loading}
          style={{
            width:"100%", padding:"14px", marginTop:16,
            background: loading ? "#555" : "#c8ff00", color:"#000", border:"none", borderRadius:10,
            fontSize:15, fontWeight:700, cursor: loading ? "wait" : "pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            transition:"all 0.15s"
          }}>
          {loading ? (
            <span style={{display:"inline-block", width:18, height:18, border:"2px solid #000", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.6s linear infinite"}} />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              {showSetup ? "Kreiraj nalog i uđi" : "Prijavi se"}
            </>
          )}
        </button>

        {!showSetup && (
          <button onClick={() => setShowSetup(true)}
            style={{width:"100%", padding:"12px", marginTop:10, background:"transparent", border:"1px solid #222", borderRadius:10, color:"#666", fontSize:13, cursor:"pointer"}}>
            Prvi put? Postavi admin nalog
          </button>
        )}

        <div style={{marginTop:32, textAlign:"center", fontSize:12, color:"#333"}}>
          AutoHouse v1.0 · Dealer Management Platform
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}


// ═══════════════════════════════════════════════════
// MAIN APP (Hash-based Router with Auth)
// Route: #/ or #/admin → admin (if logged in) or login
// Route: #/dealer/ag-motors → public storefront
// Route: #/browse → dealer directory
// ═══════════════════════════════════════════════════
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHashRoute();
  const [currentUser, setCurrentUser] = useState(null);
  const [dealers, setDealers] = useState(DEFAULT_DEALERS);
  const [cars, setCars] = useState(SAMPLE_CARS);
  const [loaded, setLoaded] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking"); // checking | online | offline

  // Load data on mount — try API first, fall back to local storage
  useEffect(() => {
    (async () => {
      // Check session
      const session = await DB.get("autohouse-session");
      if (session) {
        setCurrentUser(session);
        API.token = session.token || null;
      }
      setAuthChecked(true);

      // Try API
      const apiOk = await checkAPI();
      setApiStatus(apiOk ? "online" : "offline");

      if (apiOk) {
        try {
          const [dealerData, carData] = await Promise.all([
            API.getDealers(),
            API.getCars({ limit: 500 }),
          ]);
          if (dealerData?.length > 0) setDealers(dealerData);
          if (carData?.cars?.length > 0) setCars(carData.cars);
          setLoaded(true);
          return;
        } catch (e) {
          console.warn("API load failed, using local data:", e.message);
          setApiStatus("offline");
        }
      }

      // Fallback to local storage
      const savedDealers = await DB.get("autohouse-dealers");
      const savedCars = await DB.get("autohouse-cars");
      if (savedDealers) setDealers(savedDealers);
      if (savedCars) setCars(savedCars);
      setLoaded(true);
    })();
  }, []);

  // Save locally on changes (always, as backup)
  useEffect(() => {
    if (!loaded) return;
    DB.set("autohouse-dealers", dealers);
    DB.set("autohouse-cars", cars);
  }, [dealers, cars, loaded]);

  const handleLogin = async (user) => {
    setCurrentUser(user);
    if (user.token) API.token = user.token;
    window.location.hash = "#/admin";
  };

  const handleLogout = async () => {
    await DB.delete("autohouse-session");
    API.token = null;
    setCurrentUser(null);
    window.location.hash = "#/";
  };

  const handlePreview = (dealerId) => {
    const dealer = dealers.find(d => d.id === dealerId);
    if (dealer) window.location.hash = `#/dealer/${dealer.slug || dealer.id}`;
  };

  // Loading
  if (!authChecked) {
    return (
      <div style={{height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0a0a", flexDirection:"column", gap:16}}>
        <div style={{width:40, height:40, border:"3px solid #222", borderTopColor:"#c8ff00", borderRadius:"50%", animation:"spin 0.7s linear infinite"}} />
        <div style={{color:"#555", fontSize:13}}>Učitavanje...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ── Route: #/dealer/:slug → public storefront ──
  const dealerMatch = hash.match(/^#\/dealer\/(.+)$/);
  if (dealerMatch) {
    const slug = dealerMatch[1];
    const dealer = dealers.find(d => d.slug === slug || d.id === slug);
    if (dealer) {
      return <DealerStorefront dealer={dealer} cars={cars} onBack={() => {
        window.location.hash = currentUser ? "#/admin" : "#/browse";
      }} isPublic={!currentUser} />;
    }
    // Dealer not found
    return (
      <div style={{height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0a0a", flexDirection:"column", gap:16, fontFamily:"'Inter',sans-serif"}}>
        <div style={{width:56, height:56, borderRadius:14, background:"#c8ff0015", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto", color:"#c8ff00"}}>{Icons.car}</div>
        <h1 style={{color:"#fff", fontSize:24, fontWeight:700}}>Autokuća nije pronađena</h1>
        <p style={{color:"#666", fontSize:14}}>Ne postoji autokuća sa slug-om "{slug}"</p>
        <button onClick={() => window.location.hash = "#/browse"} style={{...btnPrimary, marginTop:8}}>Pogledaj sve autokuće</button>
      </div>
    );
  }

  // ── Route: #/browse → public dealer directory ──
  if (hash === "#/browse") {
    return <DealerDirectory dealers={dealers.filter(d => d.status === "active")} cars={cars} currentUser={currentUser} />;
  }

  // ── Route: #/admin → admin panel (needs auth) ──
  if (hash.startsWith("#/admin") || hash === "#/") {
    if (!currentUser) {
      return <LoginScreen onLogin={handleLogin} />;
    }
    return <AdminPanel onPreview={handlePreview} dealers={dealers} setDealers={setDealers} cars={cars} setCars={setCars} currentUser={currentUser} onLogout={handleLogout} apiStatus={apiStatus} />;
  }

  // Fallback
  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;
  return <AdminPanel onPreview={handlePreview} dealers={dealers} setDealers={setDealers} cars={cars} setCars={setCars} currentUser={currentUser} onLogout={handleLogout} apiStatus={apiStatus} />;
}


// ═══════════════════════════════════════════════════
// PUBLIC DEALER DIRECTORY
// ═══════════════════════════════════════════════════
function DealerDirectory({ dealers, cars, currentUser }) {
  return (
    <div style={{minHeight:"100vh", background:"#0a0a0a", color:"#fff", fontFamily:"'Inter',sans-serif"}}>
      {/* Header */}
      <div style={{padding:"20px 32px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #ffffff08"}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div style={{width:36, height:36, borderRadius:10, background:"#c8ff0015", border:"1px solid #c8ff0030", display:"flex", alignItems:"center", justifyContent:"center"}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8ff00" strokeWidth="2" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a1 1 0 011-1l3-3h10l3 3a1 1 0 011 1v6a2 2 0 01-2 2M5 17a2 2 0 002 2h1a2 2 0 002-2M14 17a2 2 0 002 2h1a2 2 0 002-2"/></svg>
          </div>
          <span style={{fontSize:18, fontWeight:700}}>AutoHouse</span>
        </div>
        <button onClick={() => window.location.hash = currentUser ? "#/admin" : "#/"}
          style={{padding:"8px 16px", background:"#151515", border:"1px solid #222", borderRadius:8, color:"#888", fontSize:13, cursor:"pointer"}}>
          {currentUser ? "← Admin Panel" : "Login"}
        </button>
      </div>

      {/* Hero */}
      <div style={{padding:"60px 32px 40px", textAlign:"center"}}>
        <h1 style={{fontSize:36, fontWeight:700, marginBottom:12}}>Pronađi svoju <span style={{color:"#c8ff00"}}>autokuću</span></h1>
        <p style={{fontSize:16, color:"#666", maxWidth:500, margin:"0 auto"}}>Izaberi autokuću i pregledaj ponudu vozila.</p>
      </div>

      {/* Dealer Grid */}
      <div style={{padding:"0 32px 60px", display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:20, maxWidth:1200, margin:"0 auto"}}>
        {dealers.map(d => {
          const dealerCars = cars.filter(c => c.dealerId === d.id && c.status === "available");
          return (
            <button key={d.id} onClick={() => window.location.hash = `#/dealer/${d.slug || d.id}`}
              style={{background:"#111", border:"1px solid #1a1a1a", borderRadius:16, overflow:"hidden", cursor:"pointer", textAlign:"left", padding:0, color:"#fff", transition:"border-color 0.2s"}}>
              {/* Card header with bg image */}
              <div style={{height:140, position:"relative", overflow:"hidden",
                background: d.bgImage
                  ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url('${d.bgImage}') center/cover no-repeat`
                  : `linear-gradient(135deg, ${d.accent||"#c8ff00"}20, #111)`
              }}>
                {/* Avatar */}
                <div style={{position:"absolute", bottom:-24, left:20}}>
                  {d.avatarImage ? (
                    <div style={{width:56, height:56, borderRadius:"50%", overflow:"hidden", border:"3px solid #111"}}>
                      <Img src={d.avatarImage} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}} />
                    </div>
                  ) : (
                    <div style={{width:56, height:56, borderRadius:"50%", background:"#1a1a1a", border:"3px solid #111", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:d.accent||"#c8ff00"}}>
                      {d.logo || d.name?.[0] || "?"}
                    </div>
                  )}
                </div>
                {/* Logo overlay */}
                <div style={{position:"absolute", top:16, right:16, opacity:0.8}}>
                  {d.logoImage ? <Img src={d.logoImage} style={{height:24}} /> : (
                    <span style={{fontSize:18, fontWeight:800, color:d.accent||"#c8ff00"}}>{d.logo}</span>
                  )}
                </div>
              </div>

              {/* Card body */}
              <div style={{padding:"32px 20px 20px"}}>
                <div style={{fontSize:18, fontWeight:700}}>{d.name}</div>
                {d.tagline && <div style={{fontSize:12, color:"#666", marginTop:2}}>{d.tagline}</div>}
                <div style={{display:"flex", gap:12, marginTop:14}}>
                  <span style={{padding:"4px 10px", background:`${d.accent||"#c8ff00"}15`, color:d.accent||"#c8ff00", borderRadius:6, fontSize:12, fontWeight:600}}>
                    {dealerCars.length} vozila
                  </span>
                  {d.address && <span style={{fontSize:12, color:"#555", display:"flex", alignItems:"center", gap:4}}>{Icons.mapPin} {d.address.split(",")[0]}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {dealers.length === 0 && (
        <div style={{textAlign:"center", padding:60, color:"#444"}}>
          <div style={{color:"#555", marginBottom:16}}>{Icons.store}</div>
          <p>Nema aktivnih autokuća.</p>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════
const btnPrimary = {
  display:"flex", alignItems:"center", gap:8, padding:"8px 20px",
  background:"#c8ff00", color:"#000", border:"none", borderRadius:8,
  fontSize:13, fontWeight:600, cursor:"pointer"
};
const btnSmall = {
  display:"flex", alignItems:"center", gap:4, padding:"6px 10px",
  background:"#1a1a1a", color:"#ccc", border:"1px solid #333", borderRadius:8,
  fontSize:12, cursor:"pointer"
};
const inputStyle = {
  background:"#1a1a1a", border:"1px solid #333", borderRadius:8,
  padding:"8px 12px", color:"#fff", fontSize:13, outline:"none"
};
const inputStyleLight = {
  width:"100%", background:"#111", border:"1px solid #333", borderRadius:10,
  padding:"12px 14px", color:"#fff", fontSize:14, outline:"none"
};
const quickActionBtn = {
  width:"100%", padding:"10px 12px", background:"#1a1a18", border:"1px solid #ffffff08",
  borderRadius:10, color:"#ccc", fontSize:13, cursor:"pointer", display:"flex",
  alignItems:"center", gap:8, marginBottom:6, textAlign:"left"
};
const langBtn = {
  padding:"6px 12px", background:"#222", border:"none", borderRadius:8,
  color:"#888", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:4
};
