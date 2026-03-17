#!/usr/bin/env node
/**
 * Deploy latest code to VPS: git pull, clear DB (keep admin), build, restart.
 * Run: node scripts/deploy-update.js
 *
 * Requires: npm install ssh2 (run once)
 */
const { Client } = require("ssh2");

const HOST = "194.61.52.14";
const USER = "root";
const PASSWORD = "zCpHfwfemQd4X03";
const BRANCH = "feature/wordle-game";
const APP_DIR = "/var/www/english-app";

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
      `cd ${APP_DIR} && git pull origin ${BRANCH}`,
      "1. Git pull"
    );
    await run(conn, `cd ${APP_DIR} && npm ci`, "2. npm ci");
    await run(conn, `cd ${APP_DIR} && npx prisma db push`, "3. Prisma db push");
    await run(
      conn,
      `cd ${APP_DIR} && node scripts/clear-db-keep-admin.js`,
      "4. Clear DB (keep admin)"
    );
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
