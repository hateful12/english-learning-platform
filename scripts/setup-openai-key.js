#!/usr/bin/env node
/**
 * Add OPENAI_API_KEY to server .env and restart the app.
 * Run: node scripts/setup-openai-key.js sk-your-key-here
 * Or:  set OPENAI_API_KEY=sk-your-key-here && node scripts/setup-openai-key.js
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

const key = process.argv[2] || process.env.OPENAI_API_KEY;
if (!key || !key.trim()) {
  console.error("Usage: node scripts/setup-openai-key.js sk-your-key-here");
  console.error("   Or: set OPENAI_API_KEY=sk-... && node scripts/setup-openai-key.js");
  process.exit(1);
}

const trimmed = key.trim();
if (!trimmed.startsWith("sk-")) {
  console.error("OpenAI API keys usually start with sk-. Check your key at https://platform.openai.com/api-keys");
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
    // Remove existing OPENAI_API_KEY line, then append new one
    const escaped = trimmed.replace(/'/g, "'\\''");
    await run(
      conn,
      `cd ${APP_DIR} && grep -v '^OPENAI_API_KEY=' .env > .env.tmp 2>/dev/null || true && echo 'OPENAI_API_KEY=${escaped}' >> .env.tmp && mv .env.tmp .env && chmod 600 .env`,
      "1. Update .env with OPENAI_API_KEY"
    );
    await run(conn, `cd ${APP_DIR} && pm2 restart english-app`, "2. Restart pm2");
    await run(conn, "pm2 save", "3. Save pm2");

    console.log("\n\n=== Done ===");
    console.log("OpenAI API key is set. Try the Progress Test again.");
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
