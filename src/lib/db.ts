import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "storage");
const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "app.db");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "outputs"), { recursive: true });

declare global {
  var __nbpDb: Database.Database | undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  mode TEXT NOT NULL,
  resolution TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  output_count INTEGER NOT NULL,
  input_image_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  partial INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  provider_name TEXT NOT NULL DEFAULT 'nano_banana_pro',
  provider_job_id TEXT,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  actual_cost_usd REAL,
  preset_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON generation_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs (status);

CREATE TABLE IF NOT EXISTS generation_input_images (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_input_images_job ON generation_input_images (job_id);

CREATE TABLE IF NOT EXISTS generation_output_images (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_output_images_job ON generation_output_images (job_id);

CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  mode TEXT NOT NULL,
  resolution TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  output_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function createConnection(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("busy_timeout = 15000");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

// Reused across hot reloads in dev; each Next.js server process gets one connection.
export const db = globalThis.__nbpDb ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalThis.__nbpDb = db;
}

export { DATA_DIR };
