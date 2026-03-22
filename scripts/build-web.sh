#!/usr/bin/env bash
# Build the web app:
# 1. Build browser.global.js via tsup (analysis engine IIFE bundle)
# 2. Inline shared code into app/web/dist/index.html from template
# 3. Copy browser.global.js alongside index.html (loaded via script src)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_SRC="$ROOT/app/web/src"
WEB_DIST="$ROOT/app/web/dist"
SHARED_DIR="$ROOT/app/shared"

echo "=== Building CanICode Web App ==="

# Ensure dist directory exists
mkdir -p "$WEB_DIST"

# Step 1: Build the browser bundle (outputs to app/web/dist/)
echo "[1/2] Building browser.global.js..."
npx tsup src/browser.ts --config tsup.browser.config.ts

# Step 2: Inline shared code into index.html
echo "[2/2] Inlining shared code into index.html..."

TEMPLATE="$WEB_SRC/index.html"
OUTPUT="$WEB_DIST/index.html"

if [ ! -f "$TEMPLATE" ]; then
  echo "ERROR: $TEMPLATE not found."
  exit 1
fi

node -e "
  const fs = require('fs');
  let output = fs.readFileSync('$TEMPLATE', 'utf-8');

  // Inline shared code
  const sharedFiles = {
    '/* __SHARED_CONSTANTS_INJECT__ */': fs.readFileSync('$SHARED_DIR/constants.js', 'utf-8'),
    '/* __SHARED_UTILS_INJECT__ */': fs.readFileSync('$SHARED_DIR/utils.js', 'utf-8'),
    '/* __SHARED_GAUGE_INJECT__ */': fs.readFileSync('$SHARED_DIR/gauge.js', 'utf-8'),
  };

  for (const [placeholder, content] of Object.entries(sharedFiles)) {
    const idx = output.indexOf(placeholder);
    if (idx === -1) { console.error('ERROR: placeholder not found: ' + placeholder); process.exit(1); }
    output = output.slice(0, idx) + content + output.slice(idx + placeholder.length);
  }

  fs.writeFileSync('$OUTPUT', output, 'utf-8');
  console.log('  index.html written (' + Math.round(output.length / 1024) + ' KB)');
"

echo ""
echo "=== Web app built successfully ==="
echo "  $WEB_DIST/browser.global.js"
echo "  $WEB_DIST/index.html"
