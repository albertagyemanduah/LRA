#!/usr/bin/env bash
# start.sh — Start all services
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
echo "Services started. Run 'pm2 list' to verify."
