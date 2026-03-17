#!/usr/bin/env node
/**
 * Configure Nginx for HTTPS using Certbot (Let's Encrypt).
 * Run: node scripts/configure-nginx-https.js [domain]
 *
 * Examples:
 *   node scripts/configure-nginx-https.js                    # uses 194.61.52.14.nip.io (IP-based)
 *   node scripts/configure-nginx-https.js senira.english.com
 */
const { Client } = require("ssh2");

const HOST = "194.61.52.14";
const USER = "root";
const PASSWORD = "zCpHfwfemQd4X03";
const DEFAULT_DOMAIN = "194.61.52.14.nip.io";

const domain = process.argv[2] || DEFAULT_DOMAIN;

function run(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${label}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream
        .on("close", (code) => {
          console.log(out);
          if (code !== 0) reject(new Error(`Exit code ${code}`));
          else resolve();
        })
        .on("data", (d) => {
          out += d.toString();
          process.stdout.write(d);
        })
        .stderr.on("data", (d) => process.stderr.write(d));
    });
  });
}

const nginxConf = `server {
    listen 80 default_server;
    server_name ${domain} 194.61.52.14;
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

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on("ready", resolve)
      .on("error", reject)
      .connect({
        host: HOST,
        port: 22,
        username: USER,
        password: PASSWORD,
        readyTimeout: 15000,
      });
  });

  console.log("Connected to", HOST);
  console.log("Domain:", domain);

  try {
    await run(
      conn,
      `cat > /etc/nginx/sites-available/english-app << 'NGINX_EOF'
${nginxConf}
NGINX_EOF`,
      "1. Write Nginx config"
    );
    await run(conn, "nginx -t && systemctl reload nginx", "2. Reload Nginx");
    await run(
      conn,
      `certbot --nginx -d ${domain} --non-interactive --agree-tos --email admin@${domain} --redirect`,
      "3. Certbot SSL (Let's Encrypt)"
    );

    const appUrl = `https://${domain}`;
    await run(
      conn,
      `cd /var/www/english-app && grep -q '^APP_URL=' .env 2>/dev/null && sed -i 's|^APP_URL=.*|APP_URL=${appUrl}|' .env || echo 'APP_URL=${appUrl}' >> .env`,
      "4. Set APP_URL in .env"
    );

    console.log("\n\n=== HTTPS configured ===");
    console.log("App URL:", appUrl);
    console.log("Update app_url in Teacher Settings for Monobank webhook.");
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
