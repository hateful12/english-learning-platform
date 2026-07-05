const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  conn.exec("sqlite3 /var/www/english-app/prisma/prisma/dev.db \".tables\"", (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("data", d => process.stdout.write(d));
    stream.stderr.on("data", d => process.stderr.write(d));
    stream.on("close", () => conn.end());
  });
}).connect({ host: "194.61.52.14", port: 22, username: "root", password: "zCpHfwfemQd4X03" });
