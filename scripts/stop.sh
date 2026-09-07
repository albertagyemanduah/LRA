#!/usr/bin/env bash
# stop.sh — Stop all services
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pm2 stop ecosystem.config.cjs && pm2 save
echo "Services stopped."
