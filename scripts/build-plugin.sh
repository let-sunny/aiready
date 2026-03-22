#!/usr/bin/env bash
# Build the Figma plugin:
# 1. Build browser.global.js (analysis engine IIFE bundle)
# 2. Compile app/figma-plugin/src/main.ts -> app/figma-plugin/dist/main.js
# 3. Inline shared code + browser.global.js into app/figma-plugin/dist/ui.html

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_DIR="$ROOT/app/figma-plugin"
PLUGIN_SRC="$PLUGIN_DIR/src"
PLUGIN_DIST="$PLUGIN_DIR/dist"
WEB_DIST="$ROOT/app/web/dist"
SHARED_DIR="$ROOT/app/shared"

# Load .env if present
if [ -f "$ROOT/.env" ]; then
  set -a
  source "$ROOT/.env"
  set +a
fi

echo "=== Building CanICode Figma Plugin ==="

# Ensure dist directory exists
mkdir -p "$PLUGIN_DIST"

# Step 1: Build the browser bundle
echo "[1/3] Building browser.global.js..."
pnpm build:web

# Step 2: Compile plugin main.ts
echo "[2/3] Compiling app/figma-plugin/src/main.ts..."

# Compile from plugin directory so tsconfig.json is picked up
cd "$PLUGIN_DIR"
npx tsc --project tsconfig.json
# Move compiled output from build/ to dist/
mv build/main.js dist/main.js
rm -rf build
cd "$ROOT"

# Step 3: Inline shared code + browser.global.js into ui.html
echo "[3/3] Inlining shared code + browser bundle into ui.html..."

BROWSER_JS="$WEB_DIST/browser.global.js"
TEMPLATE="$PLUGIN_SRC/ui.template.html"
OUTPUT="$PLUGIN_DIST/ui.html"

if [ ! -f "$BROWSER_JS" ]; then
  echo "ERROR: $BROWSER_JS not found. Run 'pnpm build:web' first."
  exit 1
fi

if [ ! -f "$TEMPLATE" ]; then
  echo "ERROR: $TEMPLATE not found."
  exit 1
fi

# Use node to do all replacements (safer than sed for large files)
node -e "
  const fs = require('fs');
  let output = fs.readFileSync('$TEMPLATE', 'utf-8');

  // Inline shared code
  const sharedFiles = {
    '/* __SHARED_STYLES_INJECT__ */': fs.readFileSync('$SHARED_DIR/styles.css', 'utf-8'),
    '/* __SHARED_CONSTANTS_INJECT__ */': fs.readFileSync('$SHARED_DIR/constants.js', 'utf-8'),
    '/* __SHARED_UTILS_INJECT__ */': fs.readFileSync('$SHARED_DIR/utils.js', 'utf-8'),
    '/* __SHARED_GAUGE_INJECT__ */': fs.readFileSync('$SHARED_DIR/gauge.js', 'utf-8'),
  };

  for (const [placeholder, content] of Object.entries(sharedFiles)) {
    const idx = output.indexOf(placeholder);
    if (idx === -1) { console.error('ERROR: placeholder not found: ' + placeholder); process.exit(1); }
    output = output.slice(0, idx) + content + output.slice(idx + placeholder.length);
  }

  // Inline browser bundle
  const browserJs = fs.readFileSync('$BROWSER_JS', 'utf-8');
  const bundlePlaceholder = '/* __CANICODE_BROWSER_BUNDLE_INJECT__ */';
  const bundleIdx = output.indexOf(bundlePlaceholder);
  if (bundleIdx === -1) { console.error('ERROR: browser bundle placeholder not found'); process.exit(1); }
  output = output.slice(0, bundleIdx) + browserJs + output.slice(bundleIdx + bundlePlaceholder.length);

  // Inject monitoring keys if available
  const phKey = process.env.POSTHOG_API_KEY || '';
  const sDsn = process.env.SENTRY_DSN || '';
  const version = require('$ROOT/package.json').version;
  output = output.replace('/* __POSTHOG_API_KEY__ */', phKey);
  output = output.replace('/* __SENTRY_DSN__ */', sDsn);
  output = output.replace('/* __VERSION__ */', version);
  fs.writeFileSync('$OUTPUT', output, 'utf-8');
  console.log('  ui.html written (' + Math.round(output.length / 1024) + ' KB)');
"

# Copy icon to dist
if [ -f "$PLUGIN_DIR/icon.png" ]; then
  cp "$PLUGIN_DIR/icon.png" "$PLUGIN_DIST/icon.png"
fi

echo ""
echo "=== Plugin built successfully ==="
echo "  $PLUGIN_DIST/main.js"
echo "  $PLUGIN_DIST/ui.html"
echo "  $PLUGIN_DIR/manifest.json"
echo ""
echo "To test: Figma > Plugins > Development > Import plugin from manifest"
echo "         Select: $PLUGIN_DIR/manifest.json"
