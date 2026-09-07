#!/usr/bin/env bash
# backup.sh — Backup PocketBase data to a timestamped archive
# Usage: bash scripts/backup.sh [/path/to/backup/dir]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${1:-$ROOT/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE="$BACKUP_DIR/landregistry_backup_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "==> Backing up PocketBase data to $ARCHIVE ..."
tar -czf "$ARCHIVE" \
    -C "$ROOT" \
    apps/pocketbase/pb_data \
    apps/pocketbase/pb_migrations \
    apps/pocketbase/pb_hooks

echo "==> Backup size: $(du -sh "$ARCHIVE" | cut -f1)"

# Keep last 7 daily backups
echo "==> Pruning backups older than 7 days..."
find "$BACKUP_DIR" -name "landregistry_backup_*.tar.gz" -mtime +7 -delete

echo "==> Backup complete: $ARCHIVE"
