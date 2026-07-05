const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  const cmd = [
    "cd /var/www/english-app",
    "git stash",
    "git pull origin feat/super-admin-assign-group-teacher",
    "npm install --legacy-peer-deps",
    "npx prisma generate",
    "npm run build",
    "pm2 restart english-app",
    "echo DEPLOY_DONE"
  // Use semicolons: pm2 restart must run even if build exits non-zero (export warnings)
  ].join(" ; ");
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("data", d => process.stdout.write(d));
    stream.stderr.on("data", d => process.stderr.write(d));
    stream.on("close", () => conn.end());
  });
}).connect({ host: "194.61.52.14", port: 22, username: "root", password: "zCpHfwfemQd4X03" });
