#!/usr/bin/env bash
# Build the web app:
# 1. Build browser.global.js via tsup (analysis engine + render functions IIFE bundle)
# 2. Copy index.html to dist
# 3. Copy browser.global.js alongside index.html (loaded via script src)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_SRC="$ROOT/app/web/src"
WEB_DIST="$ROOT/app/web/dist"

echo "=== Building CanICode Web App ==="

# Ensure dist directory exists
mkdir -p "$WEB_DIST"

# Step 1: Build the browser bundle (outputs to app/web/dist/)
echo "[1/2] Building browser.global.js..."
npx tsup src/browser.ts --config tsup.browser.config.ts

# Step 2: Copy static assets
echo "[2/3] Copying index.html..."
cp "$WEB_SRC/index.html" "$WEB_DIST/index.html"

echo "[3/3] Copying shared styles + favicon..."
cp "$ROOT/app/shared/styles.css" "$WEB_DIST/styles.css"
cp "$ROOT/docs/images/favicon.png" "$WEB_DIST/favicon.png"

echo ""
echo "=== Web app built successfully ==="
echo "  $WEB_DIST/browser.global.js"
echo "  $WEB_DIST/styles.css"
echo "  $WEB_DIST/index.html"
