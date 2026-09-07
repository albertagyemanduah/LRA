#!/usr/bin/env bash
# health-check.sh — Check application and service health
set -euo pipefail

OK=0; FAIL=0

check() {
  local name="$1"; local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo "  ✓ $name"
    OK=$((OK+1))
  else
    echo "  ✗ $name — FAILED"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Health Check: Techiman North Land Registry ==="

echo ""
echo "-- Process status (PM2) --"
check "PM2 daemon running"       "pm2 ping"
check "PocketBase process up"    "pm2 describe pocketbase | grep -q 'online'"
check "Express API process up"   "pm2 describe api       | grep -q 'online'"

echo ""
echo "-- Network endpoints --"
check "PocketBase /api/health"   "curl -sf http://localhost:8090/api/health"
check "Express API /health"      "curl -sf http://localhost:3001/health"

echo ""
echo "-- File system --"
check "Frontend dist present"    "[ -f apps/web/dist/index.html ]"
check "PocketBase binary"        "[ -x apps/pocketbase/pocketbase ]"
check "PocketBase data dir"      "[ -d apps/pocketbase/pb_data ]"
check "Logs directory"           "[ -d logs ]"

echo ""
echo "==========================================="
echo "  Passed: $OK   Failed: $FAIL"
echo "==========================================="
[ "$FAIL" -eq 0 ] || exit 1
