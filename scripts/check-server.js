#!/usr/bin/env node
/**
 * Check server status: PM2, nginx, app health.
 * Run: set DEPLOY_SSH_HOST=... DEPLOY_SSH_PASSWORD=... && node scripts/check-server.js
 */
const { Client } = require("ssh2");

const HOST = process.env.DEPLOY_SSH_HOST || "";
const USER = process.env.DEPLOY_SSH_USER || "root";
const PASSWORD = process.env.DEPLOY_SSH_PASSWORD || "";
if (!HOST || !PASSWORD) {
  console.error("Set DEPLOY_SSH_HOST and DEPLOY_SSH_PASSWORD (see script header).");
  process.exit(1);
}

function run(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream
        .on("close", (code) => resolve({ code, out }))
        .on("data", (d) => { out += d.toString(); })
        .stderr.on("data", (d) => { out += d.toString(); });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve).on("error", reject).connect({
      host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 15000,
    });
  });

  console.log("Connected to", HOST, "\n");

  const r1 = await run(conn, "pm2 list");
  console.log("=== PM2 ===");
  console.log(r1.out);

  const r2 = await run(conn, "systemctl is-active nginx");
  console.log("=== Nginx ===");
  console.log("Status:", r2.out.trim());

  const r3 = await run(conn, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/");
  console.log("\n=== App (localhost:3000) ===");
  console.log("HTTP code:", r3.out.trim());

  const r4 = await run(conn, "pm2 logs english-app --lines 15 --nostream");
  console.log("\n=== PM2 logs (last 15 lines) ===");
  console.log(r4.out);

  conn.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
