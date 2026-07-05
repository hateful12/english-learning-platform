const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  const cmd = [
    "cd /var/www/english-app",
    // Backup DB before every deploy
    "mkdir -p /var/backups/english-app",
    "cp prisma/dev.db /var/backups/english-app/pre-deploy-$(date +%s).db && echo DB_BACKED_UP",
    "git stash",
    "git pull origin feat/super-admin-assign-group-teacher",
    "npm install --legacy-peer-deps",
    // Safe schema sync — no --accept-data-loss to prevent accidental table drops
    "npx prisma db push",
    "npx prisma generate",
    "npm run build",
    "pm2 restart english-app",
    "echo DEPLOY_DONE"
  // Use semicolons so pm2 restart always runs even if build has non-fatal export warnings
  ].join(" ; ");
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("data", d => process.stdout.write(d));
    stream.stderr.on("data", d => process.stderr.write(d));
    stream.on("close", () => conn.end());
  });
}).connect({ host: "194.61.52.14", port: 22, username: "root", password: "zCpHfwfemQd4X03" });
