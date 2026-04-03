#!/usr/bin/env node
/**
 * Fix deployment: clean rebuild to resolve Server Action mismatch.
 * Run: set DEPLOY_SSH_HOST=... DEPLOY_SSH_PASSWORD=... && node scripts/deploy-fix.js
 * Optional: DEPLOY_APP_DIR, DEPLOY_PUBLIC_URL (hint printed at end).
 */
const { Client } = require("ssh2");

const HOST = process.env.DEPLOY_SSH_HOST || "";
const USER = process.env.DEPLOY_SSH_USER || "root";
const PASSWORD = process.env.DEPLOY_SSH_PASSWORD || "";
const APP_DIR = process.env.DEPLOY_APP_DIR || "/var/www/english-app";
if (!HOST || !PASSWORD) {
  console.error("Set DEPLOY_SSH_HOST and DEPLOY_SSH_PASSWORD (see script header).");
  process.exit(1);
}

function run(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log("\n>>>", label);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream
        .on("close", (code) => {
          process.stdout.write(out);
          if (code !== 0) reject(new Error(`Exit code ${code}`));
          else resolve();
        })
        .on("data", (d) => { out += d.toString(); process.stdout.write(d); })
        .stderr.on("data", (d) => process.stderr.write(d));
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve).on("error", reject).connect({
      host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 30000,
    });
  });

  console.log("Connected to", HOST);

  try {
    await run(conn, `cd ${APP_DIR} && git pull --ff-only`, "0. Git pull");
    await run(conn, `cd ${APP_DIR} && pm2 stop english-app`, "1. Stop app");
    await run(conn, `cd ${APP_DIR} && rm -rf .next`, "2. Remove .next cache");
    await run(conn, `cd ${APP_DIR} && npm run build`, "3. Clean build");
    await run(conn, `cd ${APP_DIR} && pm2 delete english-app 2>/dev/null; pm2 start npm --name english-app -- start`, "4. Fresh PM2 start");
    await run(conn, "pm2 save", "5. Save PM2");

    console.log("\n\n=== Fix complete ===");
    const hint = process.env.DEPLOY_PUBLIC_URL || `http://${HOST}.nip.io/`;
    console.log("Try", hint, "— do a hard refresh (Ctrl+Shift+R) to clear cached JS.");
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
