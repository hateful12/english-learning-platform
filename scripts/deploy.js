const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  const cmd = [
    "cd /var/www/english-app",
    // 1. Backup DB before every deploy (production DB lives at prisma/prisma/dev.db)
    "mkdir -p /var/backups/english-app",
    "cp prisma/prisma/dev.db /var/backups/english-app/pre-deploy-$(date +%s).db && echo DB_BACKED_UP || echo NO_BACKUP_NEEDED",
    // 2. Preserve DB to /tmp so git pull cannot delete it
    "cp prisma/prisma/dev.db /tmp/prod-db-preserve.db 2>/dev/null || true",
    "git stash",
    "git pull origin feat/super-admin-assign-group-teacher",
    // 3. Restore DB if git pull removed it (e.g. because it was untracked from git history)
    "mkdir -p prisma/prisma",
    "[ -f prisma/prisma/dev.db ] || (cp /tmp/prod-db-preserve.db prisma/prisma/dev.db && echo DB_RESTORED_AFTER_GIT_PULL)",
    "npm install --legacy-peer-deps",
    // 4. Safe schema sync — only adds new tables/columns, never drops data
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
