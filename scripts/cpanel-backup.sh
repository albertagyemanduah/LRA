#!/bin/bash
# ============================================================
# cPanel Backup Script — Techiman North Land Registry
# Schedule via cPanel Cron: 0 2 * * * /home/tendagov/public_html/scripts/cpanel-backup.sh
# ============================================================

set -e

APP_DIR="/home/tendagov/public_html"
BACKUP_DIR="/home/tendagov/backups"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_NAME="landreg_backup_$TIMESTAMP"
LOG_FILE="/home/tendagov/logs/backup.log"

mkdir -p "$BACKUP_DIR" /home/tendagov/logs

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup: $BACKUP_NAME" | tee -a "$LOG_FILE"

# --- Backup PocketBase SQLite database ---
echo "[BACKUP] Backing up PocketBase database..." | tee -a "$LOG_FILE"
if [ -d "$APP_DIR/apps/pocketbase/pb_data" ]; then
  tar -czf "$BACKUP_DIR/${BACKUP_NAME}_pocketbase.tar.gz" \
    -C "$APP_DIR/apps/pocketbase" pb_data/ 2>&1 | tee -a "$LOG_FILE"
  echo "[BACKUP] PocketBase backup saved: ${BACKUP_NAME}_pocketbase.tar.gz" | tee -a "$LOG_FILE"
fi

# --- Backup uploads ---
echo "[BACKUP] Backing up uploads..." | tee -a "$LOG_FILE"
if [ -d "/home/tendagov/uploads" ]; then
  tar -czf "$BACKUP_DIR/${BACKUP_NAME}_uploads.tar.gz" \
    -C /home/tendagov uploads/ 2>&1 | tee -a "$LOG_FILE"
fi

# --- Backup MySQL database (tendagov_ppd) ---
echo "[BACKUP] Backing up MySQL database..." | tee -a "$LOG_FILE"
if command -v mysqldump &> /dev/null; then
  mysqldump --host=localhost --port=3306 \
    --user=tendagov_ppd \
    --password='AlbyAko@10?/04' \
    tendagov_ppd > "$BACKUP_DIR/${BACKUP_NAME}_mysql.sql" 2>/dev/null || \
    echo "[BACKUP] MySQL backup skipped (database may be empty)" | tee -a "$LOG_FILE"
  if [ -f "$BACKUP_DIR/${BACKUP_NAME}_mysql.sql" ]; then
    gzip "$BACKUP_DIR/${BACKUP_NAME}_mysql.sql"
    echo "[BACKUP] MySQL backup saved: ${BACKUP_NAME}_mysql.sql.gz" | tee -a "$LOG_FILE"
  fi
fi

# --- Backup environment config ---
echo "[BACKUP] Backing up configuration..." | tee -a "$LOG_FILE"
cp "$APP_DIR/apps/api/.env" "$BACKUP_DIR/${BACKUP_NAME}_env.bak" 2>/dev/null || true

# --- Remove backups older than 30 days ---
echo "[BACKUP] Cleaning old backups (>30 days)..." | tee -a "$LOG_FILE"
find "$BACKUP_DIR" -name "landreg_backup_*" -mtime +30 -delete 2>/dev/null || true

# --- Summary ---
BACKUP_SIZE=$(du -sh "$BACKUP_DIR/${BACKUP_NAME}_pocketbase.tar.gz" 2>/dev/null | cut -f1 || echo "N/A")
echo "[BACKUP] Backup complete! PocketBase size: $BACKUP_SIZE" | tee -a "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup finished." | tee -a "$LOG_FILE"
