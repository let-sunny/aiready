#!/usr/bin/env bash
set -euo pipefail

# Nightly calibration: one pass over fixtures (Claude /calibrate-loop), then gap-based rule review.
#
# Each /calibrate-loop invocation creates its own run directory under logs/calibration/<name>--<timestamp>/.
# No manual snapshot copying needed — run directories are self-contained.
#
# Phase 1 — For each fixture: run calibration.
# Phase 2 — canicode calibrate-gap-report → logs/calibration/REPORT.md
# Phase 3 — Manual: review the report, then run /add-rule in Claude Code.
#
# Usage:
#   export CALIBRATE_FIXTURES="fixtures/a.json,fixtures/b.json,..."
#   ./scripts/calibrate-night.sh
#   ./scripts/calibrate-night.sh --deep   # uses /calibrate-loop-deep instead
#
# Optional:
#   CALIBRATE_SKIP_PHASE2=1     — only Phase 1 (no gap report)
#   CALIBRATE_SKIP_BUILD=1      — skip pnpm build before Phase 2 (use existing dist/)
#   CALIBRATE_AUTO_COMMIT=1     — git commit + push at end if rule-config or logs changed

COMMAND="/calibrate-loop"

for arg in "$@"; do
  case "$arg" in
    --deep)
      COMMAND="/calibrate-loop-deep"
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
fi

if [ -z "${CALIBRATE_FIXTURES:-}" ]; then
  echo "Error: CALIBRATE_FIXTURES is not set."
  echo ""
  echo "Example:"
  echo "  export CALIBRATE_FIXTURES=\"fixtures/material3-kit-1.json,fixtures/material3-kit-2.json,...\""
  echo "  ./scripts/calibrate-night.sh"
  echo ""
  echo "Or add CALIBRATE_FIXTURES to .env"
  exit 1
fi

IFS=',' read -ra FIXTURES <<< "$CALIBRATE_FIXTURES"

for f in "${FIXTURES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "Error: Fixture not found: $f"
    exit 1
  fi
done

# Nightly-level log (not per-run — tracks the orchestration itself)
NIGHTLY_LOG_DIR="logs/activity"
mkdir -p "$NIGHTLY_LOG_DIR"

DATETIME=$(date +%Y-%m-%d-%H-%M)
NIGHTLY_LOG="$NIGHTLY_LOG_DIR/${DATETIME}-nightly.md"

log() {
  local timestamp
  timestamp=$(date +%H:%M)
  echo "## $timestamp — $1" >> "$NIGHTLY_LOG"
  echo "" >> "$NIGHTLY_LOG"
  if [ -n "${2:-}" ]; then
    echo "$2" >> "$NIGHTLY_LOG"
    echo "" >> "$NIGHTLY_LOG"
  fi
}

echo "# Calibration night — $DATETIME" > "$NIGHTLY_LOG"
echo "" >> "$NIGHTLY_LOG"

if [ -z "${CAFFEINATED:-}" ]; then
  echo "Wrapping in caffeinate to prevent sleep..."
  CAFFEINATED=1 exec caffeinate -i "$0" "$@"
fi

TOTAL_START=$SECONDS
BEFORE_HASH=$(git hash-object src/rules/rule-config.ts 2>/dev/null || echo "none")

log "Phase 1 started" "Command: $COMMAND | Fixtures: ${#FIXTURES[@]}"

echo "Phase 1: calibrate ${#FIXTURES[@]} fixture(s) with ${COMMAND}"
echo ""

PASS=0
FAIL=0

for i in "${!FIXTURES[@]}"; do
  fixture="${FIXTURES[$i]}"
  idx=$((i + 1))

  echo "  [$idx/${#FIXTURES[@]}] $fixture"
  log "Fixture $idx start" "File: $fixture"

  RUN_START=$SECONDS
  if claude --dangerously-skip-permissions "$COMMAND" "$fixture"; then
    DURATION=$(( SECONDS - RUN_START ))
    log "Fixture $idx complete" "Duration: ${DURATION}s"
    echo "    Complete (${DURATION}s)"
    PASS=$((PASS + 1))
  else
    DURATION=$(( SECONDS - RUN_START ))
    log "Fixture $idx failed" "Duration: ${DURATION}s"
    echo "    Failed (${DURATION}s)"
    FAIL=$((FAIL + 1))
  fi
done

PHASE1_DURATION=$(( SECONDS - TOTAL_START ))
log "Phase 1 finished" "Passed: $PASS | Failed: $FAIL | Duration: ${PHASE1_DURATION}s"

echo ""
echo "Phase 1 done: ${PASS} passed, ${FAIL} failed (${PHASE1_DURATION}s)"
echo ""

GAP_REPORT_PATH="logs/calibration/REPORT.md"

if [ -z "${CALIBRATE_SKIP_PHASE2:-}" ]; then
  echo "Phase 2: gap rule review report → ${GAP_REPORT_PATH}"

  if [ -z "${CALIBRATE_SKIP_BUILD:-}" ]; then
    pnpm build
  fi

  if [ ! -f dist/cli/index.js ]; then
    echo "Error: dist/cli/index.js not found. Run pnpm build or unset CALIBRATE_SKIP_BUILD."
    exit 1
  fi

  node dist/cli/index.js calibrate-gap-report --output "$GAP_REPORT_PATH"

  log "Phase 2 complete" "Report: ${GAP_REPORT_PATH}"
  echo ""
  echo "Phase 2 done."
  echo "  Report: ${GAP_REPORT_PATH}"
  echo ""
  echo "Phase 3 (manual): read the report, then run /add-rule in Claude Code when you add a rule."
else
  echo "Phase 2 skipped (CALIBRATE_SKIP_PHASE2=1)."
fi

TOTAL_DURATION=$(( SECONDS - TOTAL_START ))
log "Nightly finished" "Total duration: ${TOTAL_DURATION}s | Log: $NIGHTLY_LOG"

echo "Log: $NIGHTLY_LOG"
echo "Total time: ${TOTAL_DURATION}s"

AFTER_HASH=$(git hash-object src/rules/rule-config.ts 2>/dev/null || echo "none")
HAS_CHANGES=false
if [ "$BEFORE_HASH" != "$AFTER_HASH" ]; then
  HAS_CHANGES=true
fi

if [ "${CALIBRATE_AUTO_COMMIT:-}" = "1" ]; then
  if [ "$HAS_CHANGES" = true ] || [ -n "$(git status --porcelain logs/ 2>/dev/null)" ]; then
    git add src/rules/rule-config.ts logs/ || true
    if git diff --cached --quiet; then
      echo "No staged changes to commit."
    else
      git commit -m "chore: nightly calibration — ${DATETIME}

Phase 1: ${PASS}/${#FIXTURES[@]} fixtures passed
Report: ${GAP_REPORT_PATH}"
      git push
      echo "Committed and pushed calibration changes."
    fi
  else
    echo "No rule-config or logs changes to commit."
  fi
fi
