#!/bin/bash
# Run the height-axis probe against every fixtures/done/* and emit structured
# JSON under .tmp/413-gate/<fixture>/probe.json for compare.ts to aggregate.
set -euo pipefail

OUT_ROOT=".tmp/413-gate"

for fixture_dir in fixtures/done/*/; do
  name="$(basename "${fixture_dir}")"
  out_dir="${OUT_ROOT}/${name}"
  mkdir -p "${out_dir}"
  echo "→ ${name}"
  pnpm exec tsx .tmp/413-gate/walker-sanity-height.ts \
    "${fixture_dir%/}" \
    --json-out "${out_dir}/probe.json" > "${out_dir}/probe.log" 2>&1 || {
    echo "   ✗ failed (see ${out_dir}/probe.log)"
    continue
  }
done

echo "Done: ${OUT_ROOT}"
