#!/usr/bin/env node
/**
 * Restart the Next.js app process on the VPS (no git pull / build).
 * Run (PowerShell):
 *   $env:DEPLOY_SSH_HOST="194.61.52.14"; $env:DEPLOY_SSH_PASSWORD="..."; node scripts/restart-pm2-vps.js
 */
const { Client } = require("ssh2");

const HOST = process.env.DEPLOY_SSH_HOST || "";
const USER = process.env.DEPLOY_SSH_USER || "root";
const PASSWORD = process.env.DEPLOY_SSH_PASSWORD || "";
const APP_NAME = process.env.DEPLOY_PM2_NAME || "english-app";

if (!HOST || !PASSWORD) {
  console.error("Set DEPLOY_SSH_HOST and DEPLOY_SSH_PASSWORD.");
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
