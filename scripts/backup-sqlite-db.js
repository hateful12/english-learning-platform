#!/usr/bin/env node
/**
 * Snapshot the Prisma SQLite file (from DATABASE_URL) into a timestamped copy.
 *
 * Usage (project root):
 *   node scripts/backup-sqlite-db.js
 *   BACKUP_DIR=/var/backups/english-app node scripts/backup-sqlite-db.js
 *   node scripts/backup-sqlite-db.js --keep 30
 *
 * Prisma resolves relative file: URLs against the prisma/ folder (where schema.prisma lives).
 *
 * Production (safer while the app writes): install sqlite3 and cron something like:
 *   sqlite3 /var/www/english-app/prisma/prisma/dev.db ".backup '/var/backups/english-app/auto-$(date -u +%Y%m%dT%H%M%SZ).db'"
 * Adjust the path to match: grep DATABASE_URL /var/www/english-app/.env and ls prisma/*.db
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const schemaDir = path.join(projectRoot, "prisma");

function parseEnvFile(filePath) {
  const out = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFiles() {
  const merged = {};
  for (const name of [".env", ".env.local"]) {
    const p = path.join(projectRoot, name);
    if (!fs.existsSync(p)) continue;
    Object.assign(merged, parseEnvFile(p));
  }
  for (const [key, val] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function resolveSqlitePath() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL missing. Run from project root with .env present.");
  }
  let raw = url.replace(/^file:/i, "").trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }
  if (path.isAbsolute(raw)) {
    return raw;
  }
  return path.resolve(schemaDir, raw);
}

function parseKeepArg() {
  const i = process.argv.indexOf("--keep");
  if (i === -1 || !process.argv[i + 1]) return null;
  const n = parseInt(process.argv[i + 1], 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("--keep expects a positive number");
  }
  return n;
}

function pruneOldBackups(backupDir, keep) {
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("sqlite-") && f.endsWith(".db"))
    .map((f) => ({
      name: f,
      t: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.t - a.t);
  for (let i = keep; i < files.length; i++) {
    fs.unlinkSync(path.join(backupDir, files[i].name));
  }
}

function trySqliteBackup(dbPath, destPath) {
  const sql = `.backup '${destPath.replace(/'/g, "''")}'`;
  const r = spawnSync("sqlite3", [dbPath, sql], { encoding: "utf8" });
  return r.status === 0;
}

function main() {
  loadEnvFiles();
  const src = resolveSqlitePath();
  if (!fs.existsSync(src)) {
    console.error("Database file not found:", src);
    process.exit(1);
  }

  const backupDir = process.env.BACKUP_DIR || path.join(projectRoot, "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(backupDir, `sqlite-${stamp}.db`);

  const useSqliteCli = process.env.SQLITE_ONLINE_BACKUP === "1";
  if (useSqliteCli && trySqliteBackup(src, dest)) {
    console.log("Online backup (sqlite3 .backup):", dest);
  } else {
    if (useSqliteCli) {
      console.warn("sqlite3 .backup failed; falling back to file copy. Install sqlite3 or unset SQLITE_ONLINE_BACKUP.");
    }
    fs.copyFileSync(src, dest);
    console.log("Copied:", src, "->", dest);
  }

  const keep = parseKeepArg() ?? (process.env.KEEP_BACKUPS ? parseInt(process.env.KEEP_BACKUPS, 10) : null);
  if (keep != null && Number.isFinite(keep) && keep > 0) {
    pruneOldBackups(backupDir, keep);
    console.log("Kept newest", keep, "backups in", backupDir);
  }
}

main();
