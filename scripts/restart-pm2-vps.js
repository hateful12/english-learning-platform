#!/usr/bin/env node
/**
 * Restart the Next.js app process on the VPS (no git pull / build).
 * Credentials: export DEPLOY_SSH_* or add them to .env.local (gitignored).
 * Default host: 194.61.52.14 when DEPLOY_SSH_HOST is unset.
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
const APP_NAME = process.env.DEPLOY_PM2_NAME || "english-app";

if (!PASSWORD) {
  console.error("Set DEPLOY_SSH_PASSWORD (environment or .env.local).");
  process.exit(1);
}

const conn = new Client();
conn
  .on("ready", () => {
    conn.exec(`pm2 restart ${APP_NAME} && pm2 save`, (err, stream) => {
      if (err) {
        console.error(err);
        conn.end();
        process.exit(1);
      }
      stream
        .on("close", (code) => {
          conn.end();
          process.exit(code ?? 0);
        })
        .on("data", (d) => process.stdout.write(d))
        .stderr.on("data", (d) => process.stderr.write(d));
    });
  })
  .on("error", (e) => {
    console.error(e.message);
    process.exit(1);
  })
  .connect({
    host: HOST,
    port: 22,
    username: USER,
    password: PASSWORD,
    readyTimeout: 15000,
  });
