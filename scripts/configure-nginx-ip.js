#!/usr/bin/env node
/**
 * Update Nginx to serve the app by IP (no domain required).
 * Run: node scripts/configure-nginx-ip.js
 */
const { Client } = require("ssh2");

const conn = new Client();
conn
  .on("ready", () => {
    const nginxConf = `server {
    listen 80 default_server;
    server_name _ 194.61.52.14;
    client_max_body_size 30m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}`;

    conn.exec(`cat > /etc/nginx/sites-available/english-app << 'NGINX_EOF'
${nginxConf}
NGINX_EOF
nginx -t && systemctl reload nginx`, (err, stream) => {
      if (err) {
        console.error(err);
        conn.end();
        return;
      }
      stream.on("close", (code) => {
        console.log(code === 0 ? "\nDone. App available at http://194.61.52.14/" : "\nFailed.");
        conn.end();
      }).on("data", (d) => process.stdout.write(d));
    });
  })
  .on("error", (err) => {
    console.error("SSH error:", err.message);
    process.exit(1);
  })
  .connect({
    host: "194.61.52.14",
    port: 22,
    username: "root",
    password: "zCpHfwfemQd4X03",
    readyTimeout: 15000,
  });
