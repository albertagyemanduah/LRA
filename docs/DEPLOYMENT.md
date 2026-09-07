# Deployment Guide — HPanel (Hostinger)

## Prerequisites

- Hostinger Business or Cloud plan with **Node.js** support
- Node.js 22.x enabled in HPanel → Advanced → Node.js
- SSH access or HPanel File Manager
- A domain pointing to the hosting account
- PM2 installed globally: `npm install -g pm2`

---

## Step 1 — Upload Application Files

### Via HPanel File Manager
1. Build locally: `bash scripts/build.sh`
2. Compress project (excluding `node_modules`, `pb_data`, `.env`): `tar -czf landregistry.tar.gz --exclude=node_modules --exclude=apps/pocketbase/pb_data --exclude=.env .`
3. Upload `landregistry.tar.gz` to `public_html` via File Manager
4. Extract: SSH → `cd ~/public_html && tar -xzf landregistry.tar.gz`

### Via SFTP / SSH
```bash
rsync -avz --exclude=node_modules --exclude=apps/pocketbase/pb_data --exclude=.env \
  ./ user@yourdomain.com:~/public_html/
```

---

## Step 2 — Configure Environment

```bash
cd ~/public_html
cp .env.example .env
nano .env          # fill in all required values
```

Critical variables:
- `PB_ENCRYPTION_KEY` — generate: `openssl rand -hex 32`
- `JWT_SECRET` — generate: `openssl rand -hex 64`
- `ARKESEL_API_KEY` — from your Arkesel dashboard
- `SMTP_*` — your domain email credentials

---

## Step 3 — Install Dependencies

```bash
npm ci --workspace apps/web --workspace apps/api
```

---

## Step 4 — Build Frontend

```bash
npm run build --workspace apps/web
```

The built files land in `apps/web/dist/`.

---

## Step 5 — Configure HPanel Node.js App

1. HPanel → Websites → Manage → **Advanced** → **Node.js**
2. Set **Application root**: `/home/yourusername/public_html`
3. Set **Application startup file**: `apps/api/src/main.js`
4. Set **Node.js version**: `22.x`
5. Click **Save**

> **Static files**: HPanel serves `public_html` directly. Move or symlink `apps/web/dist/*` into `public_html/` root so the SPA is served by Apache/Nginx automatically.

```bash
# On the server:
cp -r apps/web/dist/* ~/public_html/
```

---

## Step 6 — Configure .htaccess for SPA Routing

HPanel uses Apache. The file `public/.htaccess` is already pre-configured for React SPA routing. Verify it is copied:

```bash
cp public/.htaccess ~/public_html/.htaccess
```

---

## Step 7 — Start PocketBase

```bash
cd ~/public_html
chmod +x apps/pocketbase/pocketbase

# Start with PM2 (keeps running after logout)
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed command to enable auto-start
```

---

## Step 8 — Apply Database Migrations

PocketBase applies migrations automatically on startup. Verify:

```bash
curl http://localhost:8090/api/health
```

Expected: `{"code":200,"message":"API is healthy."}`

---

## Step 9 — Verify Deployment

```bash
bash scripts/health-check.sh
```

All checks should pass (✓).

---

## Step 10 — SSL (HTTPS)

In HPanel → **SSL** → enable **Let's Encrypt** for your domain. HPanel manages renewal automatically.

---

## Rollback

```bash
# Restore from backup
tar -xzf backups/landregistry_backup_YYYYMMDD_HHMMSS.tar.gz -C ~/
pm2 restart ecosystem.config.cjs
```

---

## Updating the Application

```bash
# Pull latest code
git pull origin main   # or re-upload via SFTP

# Rebuild and redeploy
bash scripts/deploy.sh
```
