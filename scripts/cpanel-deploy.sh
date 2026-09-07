#!/bin/bash
# ============================================================
# cPanel Deploy Script — Techiman North Land Registry
# Domain: https://landreg.tenda.gov.gh/
# Run from: /home/tendagov/public_html
# Usage: bash scripts/cpanel-deploy.sh
# ============================================================

set -e

APP_DIR="/home/tendagov/public_html"
LOG_FILE="/home/tendagov/logs/deploy.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p /home/tendagov/logs
echo "[$TIMESTAMP] Starting deployment..." | tee -a "$LOG_FILE"

# --- Step 1: Navigate to app directory ---
cd "$APP_DIR" || { echo "ERROR: Cannot find $APP_DIR"; exit 1; }

# --- Step 2: Install dependencies ---
echo "[DEPLOY] Installing dependencies..." | tee -a "$LOG_FILE"
npm install --production 2>&1 | tee -a "$LOG_FILE"

# --- Step 3: Build frontend ---
echo "[DEPLOY] Building frontend..." | tee -a "$LOG_FILE"
npm run build 2>&1 | tee -a "$LOG_FILE"

# --- Step 4: Set permissions ---
echo "[DEPLOY] Setting permissions..." | tee -a "$LOG_FILE"
chmod +x apps/pocketbase/pocketbase
chmod 755 apps/pocketbase/pb_data
chmod 644 apps/api/.env
mkdir -p /home/tendagov/uploads /home/tendagov/backups
chmod 755 /home/tendagov/uploads /home/tendagov/backups

# --- Step 5: Copy .htaccess ---
echo "[DEPLOY] Installing .htaccess..." | tee -a "$LOG_FILE"
if [ -f "public/htaccess-production.txt" ]; then
  cp public/htaccess-production.txt dist/.htaccess
  echo "[DEPLOY] .htaccess installed to dist/" | tee -a "$LOG_FILE"
fi

# --- Step 6: Start/restart application via PM2 ---
echo "[DEPLOY] Starting application..." | tee -a "$LOG_FILE"
if command -v pm2 &> /dev/null; then
  pm2 delete all 2>/dev/null || true
  pm2 start ecosystem.config.cjs 2>&1 | tee -a "$LOG_FILE"
  pm2 save
  echo "[DEPLOY] PM2 application started" | tee -a "$LOG_FILE"
else
  echo "[DEPLOY] WARNING: PM2 not found. Install with: npm install -g pm2" | tee -a "$LOG_FILE"
fi

echo "[$TIMESTAMP] Deployment complete!" | tee -a "$LOG_FILE"
echo "[DEPLOY] Application: https://landreg.tenda.gov.gh/"
