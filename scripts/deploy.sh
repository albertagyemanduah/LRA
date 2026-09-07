#!/usr/bin/env bash
# ============================================================
# deploy.sh — Full deployment script for HPanel / VPS
# Usage: bash scripts/deploy.sh
# Run as the hosting user on the target server.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Techiman North Land Registry — Deployment ==="

# 1. Check .env
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

# 2. Install production dependencies
echo "==> Installing dependencies..."
npm ci --workspace apps/web --workspace apps/api --workspace pocketbase-app

# 3. Build frontend
echo "==> Building frontend..."
npm run build --workspace apps/web

# 4. Apply PocketBase migrations
echo "==> Applying database migrations..."
npm run migrations:up --workspace pocketbase-app || echo "  (no pending migrations or PB not running)"

# 5. (Re)start services via PM2
echo "==> Starting/restarting services..."
if pm2 list | grep -q "pocketbase"; then
  pm2 restart ecosystem.config.cjs
else
  pm2 start ecosystem.config.cjs
fi

pm2 save

echo ""
echo "=== Deployment complete ==="
pm2 list
