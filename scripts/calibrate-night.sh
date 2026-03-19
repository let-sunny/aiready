#!/usr/bin/env bash
set -euo pipefail

# Nightly calibration script (loop mode)
# Runs /calibrate-loop against Figma files, repeats if changes detected.
# Stops on: no changes, max cycles reached, or error.
# Usage:
#   ./scripts/calibrate-night.sh

MAX_CYCLES=5
WAIT_SECONDS=1800  # 30 minutes

# ── Load .env ───────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

# ── Validate env vars ───────────────────────────────────────────────

if [ -z "${CALIBRATE_URL_1:-}" ]; then
  echo "Error: CALIBRATE_URL_1 is not set."
  echo ""
  echo "Usage:"
  echo "  export CALIBRATE_URL_1=\"https://www.figma.com/design/.../...\""
  echo "  export CALIBRATE_URL_2=\"https://www.figma.com/design/.../...\""
  echo "  ./scripts/calibrate-night.sh"
  exit 1
fi

if [ -z "${CALIBRATE_URL_2:-}" ]; then
  echo "Error: CALIBRATE_URL_2 is not set."
  echo ""
  echo "Usage:"
  echo "  export CALIBRATE_URL_1=\"https://www.figma.com/design/.../...\""
  echo "  export CALIBRATE_URL_2=\"https://www.figma.com/design/.../...\""
  echo "  ./scripts/calibrate-night.sh"
  exit 1
fi

URLS=("$CALIBRATE_URL_1" "$CALIBRATE_URL_2")

# ── Logging setup ───────────────────────────────────────────────────

LOG_DIR="logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/agent-activity-$DATE.md"

log() {
  local timestamp
  timestamp=$(date +%H:%M)
  echo "## $timestamp — $1" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
  if [ -n "${2:-}" ]; then
    echo "$2" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
  fi
}

if [ ! -f "$LOG_FILE" ]; then
  echo "# Agent Activity Log — $DATE" > "$LOG_FILE"
  echo "" >> "$LOG_FILE"
fi

# ── Prevent sleep (re-exec under caffeinate if not already) ─────────

if [ -z "${CAFFEINATED:-}" ]; then
  echo "Wrapping in caffeinate to prevent sleep..."
  CAFFEINATED=1 exec caffeinate -i "$0" "$@"
fi

# ── Cycle loop ──────────────────────────────────────────────────────

TOTAL_START=$SECONDS
STOP_REASON=""

log "Nightly Calibration Started" "Max cycles: $MAX_CYCLES | Wait between cycles: ${WAIT_SECONDS}s | Files: ${#URLS[@]}"
echo "Starting nightly calibration (max $MAX_CYCLES cycles, ${#URLS[@]} files per cycle)"
echo ""

for cycle in $(seq 1 "$MAX_CYCLES"); do
  CYCLE_START=$SECONDS
  PASS=0
  FAIL=0

  echo "=== Cycle $cycle/$MAX_CYCLES ==="
  log "Cycle $cycle Start" "Files: ${#URLS[@]}"

  # Snapshot rule-config.ts before this cycle
  BEFORE_HASH=$(git hash-object src/rules/rule-config.ts 2>/dev/null || echo "none")

  for i in "${!URLS[@]}"; do
    url="${URLS[$i]}"
    idx=$((i + 1))

    echo "  [$idx/${#URLS[@]}] $url"
    log "Cycle $cycle — File $idx Start" "URL: $url"

    RUN_START=$SECONDS

    if claude --dangerously-skip-permissions /calibrate-loop "$url"; then
      DURATION=$(( SECONDS - RUN_START ))
      log "Cycle $cycle — File $idx Complete" "Duration: ${DURATION}s"
      echo "    Complete (${DURATION}s)"
      PASS=$((PASS + 1))
    else
      DURATION=$(( SECONDS - RUN_START ))
      log "Cycle $cycle — File $idx Failed" "Duration: ${DURATION}s — exit code: $?"
      echo "    Failed (${DURATION}s)"
      FAIL=$((FAIL + 1))
    fi
  done

  CYCLE_DURATION=$(( SECONDS - CYCLE_START ))

  # Check if rule-config.ts changed
  AFTER_HASH=$(git hash-object src/rules/rule-config.ts 2>/dev/null || echo "none")
  HAS_CHANGES=false
  if [ "$BEFORE_HASH" != "$AFTER_HASH" ]; then
    HAS_CHANGES=true
  fi

  # Commit & push if changed
  if [ "$HAS_CHANGES" = true ]; then
    git add src/rules/rule-config.ts "$LOG_FILE"
    git commit -m "chore: calibrate rule scores — cycle $cycle ($DATE)

Passed: $PASS / ${#URLS[@]}, Failed: $FAIL
Cycle duration: ${CYCLE_DURATION}s"
    git push
    log "Cycle $cycle Complete — Pushed" "Duration: ${CYCLE_DURATION}s | Passed: $PASS | Failed: $FAIL | Changes committed."
    echo "  Cycle $cycle: changes committed and pushed (${CYCLE_DURATION}s)"
  else
    log "Cycle $cycle Complete — No Changes" "Duration: ${CYCLE_DURATION}s | Passed: $PASS | Failed: $FAIL"
    echo "  Cycle $cycle: no changes (${CYCLE_DURATION}s)"
    STOP_REASON="no-changes"
    break
  fi

  # Check if this was the last cycle
  if [ "$cycle" -eq "$MAX_CYCLES" ]; then
    STOP_REASON="max-cycles"
    break
  fi

  # Wait before next cycle
  echo ""
  echo "  Waiting ${WAIT_SECONDS}s before next cycle..."
  log "Waiting" "${WAIT_SECONDS}s until cycle $((cycle + 1))"
  sleep "$WAIT_SECONDS"
done

# ── Final summary ──────────────────────────────────────────────────

TOTAL_DURATION=$(( SECONDS - TOTAL_START ))

if [ -z "$STOP_REASON" ]; then
  STOP_REASON="completed"
fi

log "Nightly Calibration Finished" "Reason: $STOP_REASON | Total duration: ${TOTAL_DURATION}s"

echo ""
echo "Nightly calibration finished."
echo "  Reason: $STOP_REASON"
echo "  Total: ${TOTAL_DURATION}s"
echo "  Log: $LOG_FILE"
