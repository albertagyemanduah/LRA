# Troubleshooting Guide — cPanel Deployment

## Common Issues & Solutions

### 1. Application Not Starting

**Symptom:** Site shows blank page or "503 Service Unavailable"

**Check:**
```bash
pm2 status          # Are processes running?
pm2 logs            # Any startup errors?
cat apps/api/.env   # Is .env correct?
```

**Fix:**
```bash
cd /home/tendagov/public_html
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save
```

---

### 2. API Returns 502 Bad Gateway

**Symptom:** Login fails, data won't load

**Cause:** Express API on port 3001 not running, or `.htaccess` proxy not working

**Fix:**
```bash
# Check if Express is running
nc -z localhost 3001 && echo "Running" || echo "Not running"

# Check if mod_proxy is enabled (contact host if not)
# Restart Express
pm2 restart landreg-api
```

---

### 3. CORS Errors in Browser Console

**Symptom:** "Access-Control-Allow-Origin" errors

**Fix:** Ensure `apps/api/.env` has:
```
CORS_ORIGIN=https://landreg.tenda.gov.gh
```
No trailing slash. Restart API after change:
```bash
pm2 restart landreg-api
```

---

### 4. Password Reset Emails Not Sent

**Symptom:** Users don't receive reset emails

**Fix:** Configure SMTP in PocketBase admin:
1. Go to `https://landreg.tenda.gov.gh/hcgi/platform/_/`
2. Settings → Mail → SMTP
3. Enter your cPanel mail server details

---

### 5. SMS Not Sending

**Symptom:** No SMS notifications

**Fix:**
```bash
# Check Arkesel API key is set
grep ARKESEL apps/api/.env

# Test SMS endpoint
curl -X POST http://localhost:3001/sms \
  -H "Content-Type: application/json" \
  -d '{"to":"0551234567","message":"Test"}'
```

---

### 6. File Uploads Failing

**Symptom:** Documents, avatars, transfer letters can't upload

**Fix:**
```bash
# Check uploads directory exists and is writable
mkdir -p /home/tendagov/public_html/uploads
chmod 755 /home/tendagov/public_html/uploads

# Check PocketBase pb_data is writable
chmod 755 /home/tendagov/public_html/apps/pocketbase/pb_data
```

---

### 7. PocketBase Won't Start

**Symptom:** Database errors, can't log in

**Fix:**
```bash
# Check binary is executable
chmod +x /home/tendagov/public_html/apps/pocketbase/pocketbase

# Check pb_data permissions
chmod -R 755 /home/tendagov/public_html/apps/pocketbase/pb_data

# Restart
pm2 restart landreg-pocketbase
pm2 logs landreg-pocketbase
```

---

### 8. SSL Certificate Issues

**Symptom:** Browser shows "Not Secure" warning

**Fix:**
1. cPanel → SSL/TLS → Let's Encrypt
2. Select `landreg.tenda.gov.gh`
3. Issue/Renew certificate
4. Let's Encrypt auto-renews every 90 days

---

### 9. React SPA Routes Return 404

**Symptom:** Direct URL access (e.g., `/app/parcels`) returns 404

**Fix:** Ensure `.htaccess` is in the document root (`dist/`) with SPA fallback rule:
```apache
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

---

### 10. Database Migration Errors

**Symptom:** Collections missing, schema errors

**Fix:**
```bash
# Run migrations manually
cd /home/tendagov/public_html
npm run migrations:up --workspace=pocketbase-app
```

---

## Log Locations

| Log | Location |
|-----|----------|
| Deploy log | `/home/tendagov/logs/deploy.log` |
| Backup log | `/home/tendagov/logs/backup.log` |
| PM2 logs | `pm2 logs` or `~/.pm2/logs/` |
| Apache error | cPanel → Logs → Error Log |
| PocketBase | `pm2 logs landreg-pocketbase` |
| Express API | `pm2 logs landreg-api` |

---

## Support Contacts

- **Hosting:** Tenda Gov IT Department
- **Domain registrar:** Check DNS settings for `tenda.gov.gh`
- **SMS provider:** Arkesel support at https://arkesel.com
