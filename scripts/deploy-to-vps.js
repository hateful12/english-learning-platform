#!/usr/bin/env node
/**
 * Deploy to VPS via SSH (password auth).
 * Run: node scripts/deploy-to-vps.js
 *
 * Requires: npm install ssh2 (run once)
 */
const { Client } = require("ssh2");
const path = require("path");

const HOST = "194.61.52.14";
const USER = "root";
const PASSWORD = "zCpHfwfemQd4X03";
const REPO = "https://github.com/hateful12/english-learning-platform.git";

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
        .on("data", (d) => { out += d.toString(); process.stdout.write(d); })
        .stderr.on("data", (d) => { process.stderr.write(d); });
    });
  });
}

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
        readyTimeout: 30000,
      });
  });

  console.log("Connected to", HOST);

  try {
    await run(conn, "apt update && apt upgrade -y", "1. Update system");
    await run(conn, "apt install -y curl nginx certbot python3-certbot-nginx fail2ban", "2. Install packages");
    await run(conn, "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs", "3. Install Node.js 20");
    await run(conn, "npm install -g pm2", "4. Install PM2");

    await run(conn, "rm -rf /var/www/english-app && mkdir -p /var/www && git clone -b feature/progress-test-tab " + REPO + " /var/www/english-app", "5. Clone repo");

    await run(conn, "cd /var/www/english-app && npm ci", "6. Install deps (incl. devDeps for build)");

    // Create .env before prisma (required for DATABASE_URL)
    await run(conn, `cd /var/www/english-app && test -f .env || (echo 'DATABASE_URL="file:./prisma/dev.db"' > .env && echo 'TEACHER_PASSWORD=changeme' >> .env && echo 'NEXTAUTH_SECRET='$(openssl rand -base64 48) >> .env && echo 'NODE_ENV=production' >> .env && chmod 600 .env)`, "6b. Create .env");
    await run(conn, "cd /var/www/english-app && npx prisma db push", "7. Prisma db push");
    await run(conn, "cd /var/www/english-app && npm run build", "8. Build");

    await run(conn, "cd /var/www/english-app && pm2 delete english-app 2>/dev/null; pm2 start npm --name english-app -- start", "9. Start PM2");
    await run(conn, "pm2 save", "10. PM2 save");

    await run(conn, "ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable", "11. UFW firewall");

    const nginxConf = `server {
    listen 80;
    server_name senira.english.com;
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

    await run(conn, `cat > /etc/nginx/sites-available/english-app << 'NGINX_EOF'
${nginxConf}
NGINX_EOF`, "12. Nginx config");
    await run(conn, "ln -sf /etc/nginx/sites-available/english-app /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx", "13. Enable Nginx site");

    console.log("\n\n=== Deployment complete ===");
    console.log("Next: Add DNS A record senira.english.com -> 194.61.52.14");
    console.log("Then run: ssh root@194.61.52.14 'certbot --nginx -d senira.english.com'");
    console.log("Edit .env on server: ssh root@194.61.52.14 'nano /var/www/english-app/.env'");
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
