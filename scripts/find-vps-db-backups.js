#!/usr/bin/env node
/**
 * List possible SQLite / DB backups on the VPS (run before manual restore).
 * Uses same connectivity as deploy-update.js.
 */
const { Client } = require("ssh2");

const HOST = "194.61.52.14";
const USER = "root";
const PASSWORD = process.env.DEPLOY_SSH_PASSWORD || "zCpHfwfemQd4X03";

const cmd = [
  "echo '=== /var/backups/english-app ==='",
  "ls -la /var/backups/english-app 2>/dev/null || echo '(none)'",
  "echo '=== Any .db under /var/www (sizes) ==='",
  "find /var/www -type f \\( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \\) -exec ls -la {} \\; 2>/dev/null",
  "echo '=== Broader search /var (maxdepth 6, name *english* or *dev.db*) ==='",
  "find /var -maxdepth 6 -type f \\( -name 'dev.db' -o -name '*english*.db' \\) 2>/dev/null | head -40",
  "echo '=== /root ==='",
  "find /root -maxdepth 4 -type f -name '*.db' 2>/dev/null | head -20",
  "echo '=== apt/dekoli / automated backup dirs ==='",
  "ls -la /var/backups 2>/dev/null | head -20",
  "echo '=== same-fs .db files >80k ==='",
  "find / -xdev -type f -name '*.db' -size +80k 2>/dev/null",
].join("\n");

function run(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      stream
        .on("close", () => resolve())
        .on("data", (d) => process.stdout.write(d))
        .stderr.on("data", (d) => process.stderr.write(d));
    });
  });
}

(async () => {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on("ready", resolve)
      .on("error", reject)
      .connect({ host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 30000 });
  });
  try {
    await run(conn, cmd);
  } finally {
    conn.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
