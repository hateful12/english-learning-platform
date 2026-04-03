#!/usr/bin/env node
/**
 * Set up HTTPS for 194.61.52.14.nip.io using Let's Encrypt.
 * Run: node scripts/setup-https-nipio.js
 *
 * Certbot will modify nginx config to add SSL.
 */
const { Client } = require("ssh2");

const HOST = process.env.DEPLOY_SSH_HOST || "";
const USER = process.env.DEPLOY_SSH_USER || "root";
const PASSWORD = process.env.DEPLOY_SSH_PASSWORD || "";
const DOMAIN = process.env.DEPLOY_DOMAIN || (HOST ? `${HOST}.nip.io` : "");
if (!HOST || !PASSWORD || !DOMAIN) {
  console.error("Set DEPLOY_SSH_HOST, DEPLOY_SSH_PASSWORD, and DEPLOY_DOMAIN (or rely on HOST.nip.io).");
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
      host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 15000,
    });
  });

  console.log("Connected to", HOST);
  console.log("Setting up HTTPS for", DOMAIN);

  try {
    await run(conn, "apt-get update && apt-get install -y certbot python3-certbot-nginx", "1. Install certbot");
    await run(
      conn,
      `certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} --redirect`,
      "2. Get SSL certificate (certbot will modify nginx)"
    );
    await run(conn, "nginx -t && systemctl reload nginx", "3. Reload nginx");

    console.log("\n\n=== HTTPS ready ===");
    console.log("https://" + DOMAIN + " should now work.");
  } catch (err) {
    console.error("\nFailed:", err.message);
    console.log("\nIf certbot failed: ensure port 80 is reachable from the internet.");
    process.exit(1);
  } finally {
    conn.end();
  }
}

main();
