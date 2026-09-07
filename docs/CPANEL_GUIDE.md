# cPanel Deployment Guide — Techiman North Land Registry
**Domain:** https://landreg.tenda.gov.gh/  
**Hosting:** Tenda Gov cPanel  
**Database (MySQL):** tendagov_ppd  
**Stack:** Node.js 22 + PocketBase (SQLite) + Express API

---

## Important: Database Architecture

This application uses **PocketBase with embedded SQLite** — NOT MySQL. The MySQL database `tendagov_ppd` provided by cPanel is available for future MySQL-backed services but is **not required** to run the application. PocketBase manages its own SQLite database in `apps/pocketbase/pb_data/`.

---

## 1. cPanel Requirements

- **Node.js Selector:** Node.js 22.x or newer
- **Disk space:** Minimum 2 GB
- **RAM:** Minimum 512 MB
- **SSL:** Free Let's Encrypt via cPanel (or import existing certificate)
- **cPanel version:** 96+ recommended

---

## 2. File Upload to cPanel

### Via File Manager or FTP
1. Build the application locally:
   ```bash
   npm install
   npm run build
   ```
2. Upload the entire project directory to `/home/tendagov/public_html/`
3. Ensure `apps/pocketbase/pb_data/` directory is writable (chmod 755)
4. Ensure `apps/pocketbase/` binary is executable: `chmod +x apps/pocketbase/pocketbase`

### Via Git (recommended)
```bash
# In cPanel Terminal or SSH
cd /home/tendagov/public_html
git clone <your-repo-url> .
npm install
```

---

## 3. Node.js Application Setup in cPanel

1. Go to **cPanel → Software → Setup Node.js App**
2. Click **Create Application**
3. Configure:
   - **Node.js version:** 22.x
   - **Application mode:** Production
   - **Application root:** `public_html`
   - **Application URL:** `landreg.tenda.gov.gh`
   - **Application startup file:** `apps/api/src/main.js` (for API) or use the provided start script
4. Set environment variables (click **Edit** next to the app):
   - `NODE_ENV=production`
   - `PORT=3001`
   - `CORS_ORIGIN=https://landreg.tenda.gov.gh`
   - `APP_URL=https://landreg.tenda.gov.gh`
5. Click **Run NPM Install**
6. Click **Start App**

---

## 4. Running Both Services (PocketBase + Express)

Since cPanel Node.js Selector runs one entry point, use PM2 or the provided `ecosystem.config.cjs`:

```bash
# In cPanel Terminal / SSH
cd /home/tendagov/public_html
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # Follow instructions to auto-start on reboot
```

Alternatively, create a cPanel cron job to start the app on server restart:
- **Cron command:** `cd /home/tendagov/public_html && pm2 start ecosystem.config.cjs`
- **Frequency:** @reboot

---

## 5. Domain & SSL Setup

### Domain Configuration
1. Your domain `landreg.tenda.gov.gh` should point to the cPanel server IP via DNS
2. In cPanel → **Domains**, add `landreg.tenda.gov.gh` as an addon domain if not already set
3. Set document root to `/home/tendagov/public_html/dist` (built frontend)

### SSL Certificate
1. Go to **cPanel → Security → SSL/TLS**
2. Click **Let's Encrypt SSL** (free)
3. Select domain `landreg.tenda.gov.gh`
4. Click **Issue Certificate**
5. Auto-renewal is handled by cPanel

---

## 6. Apache .htaccess Configuration

The `.htaccess` file in `public/` handles:
- HTTP → HTTPS redirect
- SPA routing (all paths → index.html)
- API proxy to Express (port 3001)
- Security headers
- Gzip compression

Ensure `mod_rewrite` and `mod_proxy` are enabled in Apache.

---

## 7. MySQL Database Setup (optional/future use)

If you need MySQL in the future:
1. Go to **cPanel → Databases → MySQL Databases**
2. The database `tendagov_ppd` and user `tendagov_ppd` should already be provisioned
3. To verify: **MySQL Databases → Current Databases** — check `tendagov_ppd` exists
4. Connection string: `mysql://tendagov_ppd:AlbyAko@10?/04@localhost:3306/tendagov_ppd`

---

## 8. Email Setup in cPanel

1. Go to **cPanel → Email → Email Accounts**
2. Create `noreply@tenda.gov.gh` (or use existing)
3. Note SMTP credentials and update `apps/api/.env`:
   ```
   SMTP_HOST=mail.tenda.gov.gh
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=noreply@tenda.gov.gh
   SMTP_PASSWORD=your_email_password
   ```
4. PocketBase password reset emails use the built-in mailer configured via admin dashboard at `https://landreg.tenda.gov.gh/hcgi/platform/_/`

---

## 9. Backup Setup

1. Upload and schedule `scripts/cpanel-backup.sh` via cPanel Cron Jobs
2. **Daily backups:** `0 2 * * * /home/tendagov/public_html/scripts/cpanel-backup.sh`
3. Backups stored in `/home/tendagov/backups/`
4. Also enable **cPanel → Backup Wizard** for full account backups

---

## 10. File Permissions

```bash
# Set correct permissions after upload
chmod 755 /home/tendagov/public_html
chmod 755 /home/tendagov/public_html/apps/pocketbase
chmod +x  /home/tendagov/public_html/apps/pocketbase/pocketbase
chmod 755 /home/tendagov/public_html/apps/pocketbase/pb_data
chmod 644 /home/tendagov/public_html/apps/api/.env
chmod 755 /home/tendagov/public_html/scripts/*.sh
```

---

## 11. Monitoring in cPanel

1. **cPanel → Metrics → Resource Usage** — monitor CPU/RAM
2. **cPanel → Logs → Error Log** — Apache error logs
3. Application logs: `/home/tendagov/logs/`
4. PM2 logs: `pm2 logs` in SSH terminal

---

## 12. Troubleshooting

| Issue | Solution |
|-------|----------|
| App not starting | Check `pm2 logs` and `apps/api/.env` values |
| Database connection error | PocketBase uses SQLite — check `pb_data/` permissions |
| SSL not working | Re-issue Let's Encrypt certificate in cPanel |
| API returns 502 | Ensure Express API is running on port 3001 (`pm2 status`) |
| Files not uploading | Check `uploads/` folder permissions (chmod 755) |
| Password reset email not sent | Configure SMTP in PocketBase admin dashboard |
| CORS errors | Verify `CORS_ORIGIN=https://landreg.tenda.gov.gh` in `.env` |

---

## 13. Post-Deployment Checklist

- [ ] Application accessible at https://landreg.tenda.gov.gh/
- [ ] SSL certificate active (padlock in browser)
- [ ] Login/signup working
- [ ] PocketBase admin accessible at https://landreg.tenda.gov.gh/hcgi/platform/_/
- [ ] SMS notifications working (Arkesel API key set)
- [ ] File uploads working
- [ ] Password reset emails sending
- [ ] Backups scheduled
- [ ] PM2 auto-start on reboot configured
