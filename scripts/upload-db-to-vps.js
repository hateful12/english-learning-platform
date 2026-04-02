#!/usr/bin/env node
/**
 * Upload a local SQLite file to the VPS (restore prod after accidental overwrite).
 * Usage: node scripts/upload-db-to-vps.js [path-to.db]
 * Default local path: prisma/prisma/dev.db
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("ssh2");

const HOST = "194.61.52.14";
const USER = "root";
const PASSWORD = "zCpHfwfemQd4X03";
const APP_DIR = "/var/www/english-app";
const REMOTE_DB = `${APP_DIR}/prisma/prisma/dev.db`;

const localPath = path.resolve(process.argv[2] || path.join("prisma", "prisma", "dev.db"));

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream
        .on("close", (code) => (code !== 0 ? reject(new Error(`exit ${code}`)) : resolve()))
        .on("data", (d) => process.stdout.write(d))
        .stderr.on("data", (d) => process.stderr.write(d));
    });
  });
}

async function main() {
  if (!fs.existsSync(localPath)) {
    console.error("Missing file:", localPath);
    process.exit(1);
  }

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on("ready", resolve)
      .on("error", reject)
      .connect({ host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 30000 });
  });

  console.log("Connected. Uploading", localPath, "->", REMOTE_DB);

  try {
    await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        sftp.fastPut(localPath, REMOTE_DB, (e) => (e ? reject(e) : resolve()));
      });
    });
    console.log("Upload OK. Restarting app.");
    await exec(conn, "pm2 restart english-app");
    console.log("Done.");
  } finally {
    conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
