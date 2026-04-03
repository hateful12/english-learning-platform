#!/usr/bin/env node
/**
 * Deploy latest code to VPS: backup prisma/prisma/dev.db, git sync, restore DB, prisma push, build, pm2 restart.
 * Credentials: DEPLOY_SSH_* or same keys in .env.local. Default host: 194.61.52.14.
 *
 * Optional: DEPLOY_BRANCH, DEPLOY_APP_DIR, DEPLOY_CLEAR_DB=1.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("ssh2");

function mergeEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

mergeEnvLocal();

const HOST = process.env.DEPLOY_SSH_HOST || "194.61.52.14";
const USER = process.env.DEPLOY_SSH_USER || "root";
const PASSWORD = process.env.DEPLOY_SSH_PASSWORD || "";
if (!PASSWORD) {
  console.error("Set DEPLOY_SSH_PASSWORD (environment or .env.local).");
  process.exit(1);
}
const BRANCH = process.env.DEPLOY_BRANCH || "feat/learn-english-ai-tab";
const APP_DIR = process.env.DEPLOY_APP_DIR || "/var/www/english-app";

function run(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${label}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream
        .on("close", (code) => {
          console.log(out);
          if (code !== 0) reject(new Error(`Exit code ${code}`));
          else resolve();
        })
        .on("data", (d) => {
          out += d.toString();
          process.stdout.write(d);
        })
        .stderr.on("data", (d) => {
          process.stderr.write(d);
        });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on("ready", resolve)
      .on("error", reject)
      .connect({
        host: HOST,
        port: 22,
        username: USER,
        password: PASSWORD,
        readyTimeout: 30000,
      });
  });

  console.log("Connected to", HOST);

  try {
    await run(
      conn,
      `set -e
BACKUP_DIR=/var/backups/english-app
mkdir -p "$BACKUP_DIR"
TS=$(date +%s)
KEEP="$BACKUP_DIR/pre-deploy-$TS.db"
cd ${APP_DIR}
if [ -f prisma/prisma/dev.db ]; then
  cp prisma/prisma/dev.db "$KEEP"
  echo "Backed up DB to $KEEP"
else
  echo "No existing prisma/prisma/dev.db to back up (first deploy or missing file)."
fi
git fetch origin && git checkout ${BRANCH} && git reset --hard origin/${BRANCH}
if [ -f "$KEEP" ]; then
  mkdir -p prisma/prisma
  cp "$KEEP" prisma/prisma/dev.db
  echo "Restored DB from $KEEP (production data survives git sync; repo carries a baseline commit for VRS)."
else
  echo "No backup to restore — create prisma/prisma/dev.db or upload with scripts/upload-db-to-vps.js"
fi`,
      "1. Backup DB, git sync, restore DB"
    );
    await run(conn, `cd ${APP_DIR} && npm ci`, "2. npm ci");
    await run(conn, `cd ${APP_DIR} && npx prisma db push`, "3. Prisma db push");
    // Skip clear-db for production (preserve student data). Run manually if needed.
    if (process.env.DEPLOY_CLEAR_DB === "1") {
      await run(conn, `cd ${APP_DIR} && node scripts/clear-db-keep-admin.js`, "4. Clear DB (keep admin)");
    } else {
      console.log("\n>>> 4. Skip clear-db (preserve data). Set DEPLOY_CLEAR_DB=1 to clear.");
    }
    await run(conn, `cd ${APP_DIR} && npm run build`, "5. Build");
    await run(conn, `cd ${APP_DIR} && pm2 restart english-app`, "6. PM2 restart");

    console.log("\n\n=== Deploy update complete ===");
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
