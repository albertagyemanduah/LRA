# cPanel Configuration Guide — Techiman North Land Registry

## Environment Variables Reference

All variables live in `apps/api/.env`. Change these before deploying.

### Required for Production

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Required |
| `PORT` | `3001` | Express API port |
| `CORS_ORIGIN` | `https://landreg.tenda.gov.gh` | No trailing slash |
| `APP_URL` | `https://landreg.tenda.gov.gh` | Production domain |
| `JWT_SECRET` | 64-char random hex | `openssl rand -hex 64` |
| `SESSION_SECRET` | 64-char random hex | `openssl rand -hex 64` |

### MySQL Database (cPanel)

| Variable | Value |
|----------|-------|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `tendagov_ppd` |
| `DB_USER` | `tendagov_ppd` |
| `DB_PASSWORD` | `AlbyAko@10?/04` |

> **Note:** The app uses PocketBase (SQLite), not MySQL. These MySQL credentials are provisioned for future use.

### SMS (Arkesel)

| Variable | Value |
|----------|-------|
| `ARKESEL_API_KEY` | Get from arkesel.com dashboard |
| `ARKESEL_SMS_SENDER` | `TeNDA PPD` |

### File Paths (cPanel)

| Variable | Value |
|----------|-------|
| `UPLOAD_PATH` | `/home/tendagov/public_html/uploads` |
| `LOG_PATH` | `/home/tendagov/logs` |
| `BACKUP_PATH` | `/home/tendagov/backups` |

---

## CORS Configuration

The Express API allows requests only from `https://landreg.tenda.gov.gh`. To update CORS:

```
# apps/api/.env
CORS_ORIGIN=https://landreg.tenda.gov.gh
```

For multiple origins (e.g., staging + production):
```
CORS_ORIGIN=https://landreg.tenda.gov.gh,https://staging.tenda.gov.gh
```

---

## Security Configuration

### Generate Strong Secrets
```bash
# Run on your server or locally
openssl rand -hex 64  # For JWT_SECRET
openssl rand -hex 64  # For SESSION_SECRET
```

### Session Timeout
- Auto-logout after **30 minutes** of inactivity (hardcoded in `App.jsx`)
- OTP verification valid for **8 hours**

### Password Requirements
- Minimum 8 characters (enforced by PocketBase)
- No maximum limit

---

## PocketBase Admin Dashboard

After deployment, access the admin dashboard at:
```
https://landreg.tenda.gov.gh/hcgi/platform/_/
```

Configure:
1. **SMTP settings** for password reset emails
2. **Application name** and branding
3. **OAuth providers** (if needed)

---

## PM2 Ecosystem Config

`ecosystem.config.cjs` manages both processes:
- **PocketBase** on port 8090 (`apps/pocketbase/pocketbase serve`)
- **Express API** on port 3001 (`apps/api/src/main.js`)
- **Frontend** served statically from `dist/` via Apache

Start: `pm2 start ecosystem.config.cjs`  
Status: `pm2 status`  
Logs: `pm2 logs`  
Restart: `pm2 restart all`

---

## Apache Proxy Setup

`htaccess-production.txt` (rename to `.htaccess` in document root) proxies:
- `/hcgi/api/*` → `http://localhost:3001/*` (Express)
- `/hcgi/platform/*` → `http://localhost:8090/*` (PocketBase)
- All other paths → `index.html` (React SPA)

Requires `mod_proxy` and `mod_proxy_http` enabled in Apache.
