#!/bin/bash
# ============================================================
# Health Check Script — Techiman North Land Registry
# Domain: https://landreg.tenda.gov.gh/
# Usage: bash scripts/cpanel-health-check.sh
# ============================================================

DOMAIN="https://landreg.tenda.gov.gh"
API_PORT=3001
PB_PORT=8090
PASS=0
FAIL=0

check() {
  if [ "$2" = "ok" ]; then
    echo "  ✓ $1"
    PASS=$((PASS+1))
  else
    echo "  ✗ $1 — $2"
    FAIL=$((FAIL+1))
  fi
}

echo "========================================"
echo " Health Check: Techiman North Land Registry"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# --- Check Node.js ---
echo ""
echo "[Runtime]"
NODE_VER=$(node --version 2>/dev/null || echo "not found")
check "Node.js: $NODE_VER" "ok"

# --- Check PM2 ---
echo ""
echo "[Processes]"
if command -v pm2 &>/dev/null; then
  PM2_STATUS=$(pm2 list 2>/dev/null | grep -c "online" || echo "0")
  check "PM2 online processes: $PM2_STATUS" "ok"
else
  check "PM2" "not installed — run: npm install -g pm2"
fi

# --- Check ports ---
echo ""
echo "[Ports]"
if nc -z localhost $API_PORT 2>/dev/null; then
  check "Express API port $API_PORT" "ok"
else
  check "Express API port $API_PORT" "NOT listening"
fi

if nc -z localhost $PB_PORT 2>/dev/null; then
  check "PocketBase port $PB_PORT" "ok"
else
  check "PocketBase port $PB_PORT" "NOT listening"
fi

# --- Check API health endpoint ---
echo ""
echo "[API Endpoints]"
API_RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$API_PORT/health 2>/dev/null || echo "000")
if [ "$API_RESP" = "200" ]; then
  check "Express /health → HTTP $API_RESP" "ok"
else
  check "Express /health → HTTP $API_RESP" "unexpected status"
fi

PB_RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PB_PORT/api/health 2>/dev/null || echo "000")
if [ "$PB_RESP" = "200" ]; then
  check "PocketBase /api/health → HTTP $PB_RESP" "ok"
else
  check "PocketBase /api/health → HTTP $PB_RESP" "unexpected status"
fi

# --- Check database ---
echo ""
echo "[Database]"
PB_DATA="/home/tendagov/public_html/apps/pocketbase/pb_data/data.db"
if [ -f "$PB_DATA" ]; then
  DB_SIZE=$(du -sh "$PB_DATA" | cut -f1)
  check "PocketBase SQLite db ($DB_SIZE)" "ok"
else
  check "PocketBase SQLite db" "file not found at $PB_DATA"
fi

# --- Check .env ---
echo ""
echo "[Configuration]"
ENV_FILE="/home/tendagov/public_html/apps/api/.env"
if [ -f "$ENV_FILE" ]; then
  check "apps/api/.env" "ok"
else
  check "apps/api/.env" "missing"
fi

# --- Check disk space ---
echo ""
echo "[Disk]"
DISK_AVAIL=$(df -h /home/tendagov 2>/dev/null | awk 'NR==2 {print $4}' || echo "N/A")
check "Available disk space: $DISK_AVAIL" "ok"

# --- Summary ---
echo ""
echo "========================================"
echo " Results: $PASS passed, $FAIL failed"
echo "========================================"
[ $FAIL -gt 0 ] && exit 1 || exit 0
