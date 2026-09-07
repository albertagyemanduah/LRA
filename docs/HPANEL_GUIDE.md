# HPanel (Hostinger) Deployment Guide

## 1. Hosting Plan Requirements

- **Plan**: Hostinger Business Shared, Cloud, or VPS
- **Node.js**: 22.x (enable under Advanced → Node.js)
- **Storage**: Minimum 2 GB
- **SSL**: Let's Encrypt (free, auto-renewed)

---

## 2. File Upload to HPanel

### Option A — HPanel File Manager
1. Build locally: `bash scripts/build.sh`
2. Archive: `tar -czf landregistry.tar.gz --exclude=node_modules --exclude=apps/pocketbase/pb_data --exclude=.env .`
3. HPanel → File Manager → Upload → `public_html/`
4. Extract via File Manager right-click → Extract

### Option B — SFTP (FileZilla / WinSCP)
- Host: `your domain` or server IP
- Port: `21` (FTP) or `22` (SFTP — recommended)
- User/Password: HPanel FTP credentials
- Upload to: `/home/yourusername/public_html/`

---

## 3. Database Setup in HPanel

PocketBase is a self-contained binary — **no MySQL/PostgreSQL setup required**.

1. Upload `apps/pocketbase/pocketbase` (already in the archive).
2. SSH → `chmod +x ~/public_html/apps/pocketbase/pocketbase`
3. First run creates `pb_data/` automatically.
4. Access Admin UI at `http://yourdomain.com:8090/_/` to create superuser.

> **Note**: On shared hosting, port 8090 may be blocked by firewall. Use HPanel → Advanced → **Node.js** to proxy PocketBase, or upgrade to VPS/Cloud where you control ports.

---

## 4. Node.js App Configuration in HPanel

1. HPanel → Websites → **Manage** → **Advanced** → **Node.js**
2. Settings:
   - **Application root**: `/home/yourusername/public_html`
   - **Application startup file**: `apps/api/src/main.js`
   - **Node.js version**: `22.x`
3. **Environment Variables**: Add each variable from `.env.example`
4. Click **Set up Node.js app** → **Create**

---

## 5. SSL Setup

1. HPanel → Websites → **Manage** → **SSL**
2. Click **Install** next to Let's Encrypt
3. Enable **Force HTTPS** redirect

---

## 6. Domain Setup

1. HPanel → Domains → your domain → **DNS Zone**
2. Ensure A record points to your server IP
3. www CNAME or A record also points to same IP

---

## 7. Static Files (React SPA)

After building, copy dist files to `public_html` root so Apache serves them:

```bash
# SSH into server
cp -r ~/public_html/apps/web/dist/. ~/public_html/
```

The pre-configured `.htaccess` in `public/` handles SPA routing (all paths → `index.html`).  
**Verify** `public/.htaccess` is present at `~/public_html/.htaccess`.

---

## 8. PM2 on HPanel

HPanel Business/Cloud supports SSH. Install PM2 and configure auto-start:

```bash
npm install -g pm2
cd ~/public_html
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # prints a command to run — run it
```

---

## 9. Backup on HPanel

Schedule automatic backups:

```bash
# Add to crontab (crontab -e)
0 2 * * * /bin/bash /home/yourusername/public_html/scripts/backup.sh /home/yourusername/backups >> /home/yourusername/backups/backup.log 2>&1
```

HPanel also offers **Backups** in the control panel for full account snapshots.

---

## 10. Monitoring

- PM2 web dashboard: `pm2 plus` (optional paid service)
- Check logs: `pm2 logs`
- Health check: `bash ~/public_html/scripts/health-check.sh`
- Uptime Robot (free): monitor `https://yourdomain.com` for downtime alerts

---

## 11. Updating Application

```bash
# Upload new files via SFTP (skip pb_data)
rsync -avz --exclude=node_modules --exclude=apps/pocketbase/pb_data --exclude=.env \
  ./ user@yourdomain.com:~/public_html/

# SSH into server
cd ~/public_html
npm ci --workspace apps/web --workspace apps/api
npm run build --workspace apps/web
cp -r apps/web/dist/. ~/public_html/
npm run migrations:up --workspace pocketbase-app
pm2 restart ecosystem.config.cjs
```
