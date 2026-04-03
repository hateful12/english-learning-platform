#!/usr/bin/env node
/**
 * Requires: DEPLOY_SSH_HOST, DEPLOY_SSH_PASSWORD (optional DEPLOY_SSH_USER, default root).
 */
const { Client } = require("ssh2");

const HOST = process.env.DEPLOY_SSH_HOST || "";
const USER = process.env.DEPLOY_SSH_USER || "root";
const PASSWORD = process.env.DEPLOY_SSH_PASSWORD || "";
if (!HOST || !PASSWORD) {
  console.error("Set DEPLOY_SSH_HOST and DEPLOY_SSH_PASSWORD (see script header).");
  process.exit(1);
}

const conn = new Client();
conn.on("ready", () => {
  conn.exec("ufw status && echo '---' && netstat -tlnp | grep -E ':(80|3000)' && echo '---' && cat /etc/nginx/sites-enabled/english-app 2>/dev/null || cat /etc/nginx/sites-available/english-app", (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", (c) => conn.end()).on("data", (d) => process.stdout.write(d));
  });
}).on("error", (e) => { console.error(e); process.exit(1); }).connect({
  host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 15000,
});
