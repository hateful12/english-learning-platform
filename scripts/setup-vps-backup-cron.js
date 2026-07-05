const { Client } = require("ssh2");

const CRON_LINE =
  "0 */4 * * * /var/www/english-app/scripts/vps-backup.sh >> /var/log/english-app-backup.log 2>&1";

const conn = new Client();
conn.on("ready", () => {
  const cmd = [
    "cd /var/www/english-app",
    "git pull origin feat/super-admin-assign-group-teacher",
    "mkdir -p /var/backups/english-app/auto /var/backups/english-app/daily",
    "chmod +x scripts/vps-backup.sh",
    // Install cron entry if missing
    `(crontab -l 2>/dev/null | grep -F 'vps-backup.sh' || true; echo '${CRON_LINE}') | sort -u | crontab -`,
    "crontab -l | grep vps-backup || echo 'CRON_INSTALL_FAILED'",
    "./scripts/vps-backup.sh",
    "echo SETUP_DONE",
  ].join(" ; ");

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on("data", (d) => process.stdout.write(d));
    stream.stderr.on("data", (d) => process.stderr.write(d));
    stream.on("close", () => conn.end());
  });
}).connect({
  host: "194.61.52.14",
  port: 22,
  username: "root",
  password: "zCpHfwfemQd4X03",
});
