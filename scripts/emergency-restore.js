const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  // List backups sorted by timestamp to find the newest 708K+ one
  conn.exec("ls -lhtr /var/backups/english-app/ | tail -10", (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let out = "";
    stream.on("data", d => { out += d; process.stdout.write(d); });
    stream.stderr.on("data", d => process.stderr.write(d));
    stream.on("close", () => {
      // Find the best backup (newest 700K+ file = real production data)
      const lines = out.trim().split("\n");
      let best = null;
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const size = parts[4]; // e.g. "708K"
        const name = parts[parts.length - 1];
        if (size && parseInt(size) >= 600 && name.endsWith(".db")) {
          best = name;
        }
      }
      console.log("\nBest backup:", best);
      if (!best) { console.error("No suitable backup found!"); conn.end(); return; }

      const restoreCmd = [
        `mkdir -p /var/www/english-app/prisma/prisma`,
        `cp /var/backups/english-app/${best} /var/www/english-app/prisma/prisma/dev.db`,
        `echo RESTORED`,
        `ls -lh /var/www/english-app/prisma/prisma/dev.db`,
        // Add TeacherStudent table if missing
        `sqlite3 /var/www/english-app/prisma/prisma/dev.db "CREATE TABLE IF NOT EXISTS \\"TeacherStudent\\" (\\"teacherId\\" TEXT NOT NULL, \\"studentId\\" TEXT NOT NULL, \\"createdAt\\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (\\"teacherId\\", \\"studentId\\"), FOREIGN KEY (\\"teacherId\\") REFERENCES \\"Teacher\\"(\\"id\\") ON DELETE CASCADE, FOREIGN KEY (\\"studentId\\") REFERENCES \\"Student\\"(\\"id\\") ON DELETE CASCADE);"`,
        `echo TABLE_DONE`,
        `pm2 restart english-app`,
        `echo PM2_DONE`,
        // Verify
        `sqlite3 /var/www/english-app/prisma/prisma/dev.db "SELECT COUNT(*) FROM ScheduledLesson; SELECT COUNT(*) FROM Student; SELECT COUNT(*) FROM Payment;"`,
      ].join(" ; ");

      conn.exec(restoreCmd, (e2, s2) => {
        if (e2) { console.error(e2); conn.end(); return; }
        s2.on("data", d => process.stdout.write(d));
        s2.stderr.on("data", d => process.stderr.write(d));
        s2.on("close", () => conn.end());
      });
    });
  });
}).connect({ host: "194.61.52.14", port: 22, username: "root", password: "zCpHfwfemQd4X03" });
