#!/usr/bin/env node
/**
 * Upload root .env.local to the VPS as /var/www/english-app/.env.local
 * (Next.js loads .env then .env.local in production.)
 *
 * - Sets APP_URL to production for the remote file only (localhost kept in your local copy).
 * - Ensures GMAIL_USER exists if you only had gmail app password.
 *
 * Password: set VPS_SSH_PASSWORD, or keep a sibling deploy-fix.js with PASSWORD = "..." (not committed).
 *
 * Usage: node scripts/push-env-local-to-vps.js
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("ssh2");

const HOST = "194.61.52.14";
const USER = "root";
const APP_DIR = "/var/www/english-app";
const REMOTE_ENV = `${APP_DIR}/.env.local`;
const PROD_APP_URL = "https://194.61.52.14.nip.io";
const DEFAULT_GMAIL_USER = "irenn.boiko@gmail.com";

function resolvePassword() {
  if (process.env.VPS_SSH_PASSWORD?.trim()) return process.env.VPS_SSH_PASSWORD.trim();
  const deployFix = path.join(__dirname, "deploy-fix.js");
  if (!fs.existsSync(deployFix)) return null;
  const src = fs.readFileSync(deployFix, "utf8");
  const m = src.match(/PASSWORD\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function prepareRemoteEnvBody(localContent) {
  let txt = localContent.replace(/\r\n/g, "\n");
  if (!/^GMAIL_USER=/m.test(txt) && !/^EMAIL_USER=/m.test(txt)) {
    txt += `\nGMAIL_USER=${DEFAULT_GMAIL_USER}\n`;
  }
  if (/^APP_URL=/m.test(txt)) {
    txt = txt.replace(/^APP_URL=.*$/m, `APP_URL=${PROD_APP_URL}`);
  } else {
    txt += `\nAPP_URL=${PROD_APP_URL}\n`;
  }
  return txt.endsWith("\n") ? txt : `${txt}\n`;
}

function run(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream
        .on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))))
        .on("data", (d) => process.stdout.write(d))
        .stderr.on("data", (d) => process.stderr.write(d));
    });
  });
}

async function main() {
  const password = resolvePassword();
  if (!password) {
    console.error("Set VPS_SSH_PASSWORD or add scripts/deploy-fix.js with PASSWORD = \"...\" locally.");
    process.exit(1);
  }

  const localPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(localPath)) {
    console.error("Missing .env.local in project root.");
    process.exit(1);
  }

  const body = prepareRemoteEnvBody(fs.readFileSync(localPath, "utf8"));
  const buf = Buffer.from(body, "utf8");

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve).on("error", reject).connect({
      host: HOST,
      port: 22,
      username: USER,
      password,
      readyTimeout: 30000,
    });
  });

  console.log("Connected. Writing", REMOTE_ENV);

  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.writeFile(REMOTE_ENV, buf, (wErr) => {
        if (wErr) return reject(wErr);
        sftp.end();
        resolve();
      });
    });
  });

  await run(conn, `chmod 600 ${REMOTE_ENV}`);
  await run(conn, `cd ${APP_DIR} && pm2 restart english-app --update-env`);

  console.log("Done. PM2 restarted. Try Notify again on homework.");
  conn.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
