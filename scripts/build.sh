#!/usr/bin/env bash
# ============================================================
# build.sh — Production build script
# Usage: bash scripts/build.sh
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> [1/4] Cleaning previous build..."
rm -rf apps/web/dist

echo "==> [2/4] Installing dependencies..."
npm ci --workspace apps/web --workspace apps/api

echo "==> [3/4] Building frontend (Vite)..."
npm run build --workspace apps/web

echo "==> [4/4] Verifying build..."
if [ -d "apps/web/dist" ] && [ -f "apps/web/dist/index.html" ]; then
  echo "    ✓ Build successful — apps/web/dist ready"
else
  echo "    ✗ Build failed — dist/index.html missing"
  exit 1
fi

echo ""
echo "Build complete. Deploy apps/web/dist via your HPanel File Manager or SFTP."
