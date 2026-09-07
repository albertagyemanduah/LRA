#!/usr/bin/env bash
# restart.sh — Restart all services
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pm2 restart ecosystem.config.cjs
echo "Services restarted."
pm2 list
