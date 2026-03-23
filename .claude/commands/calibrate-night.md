Run nightly calibration across multiple fixtures, then generate a gap-based rule review report.

Input: $ARGUMENTS (comma-separated fixture paths, e.g. `fixtures/a.json,fixtures/b.json,fixtures/c.json`)

## Instructions

You are the nightly orchestrator. Run `/calibrate-loop` on each fixture sequentially, then generate the aggregate report.

### Step 0 — Parse fixtures

Split the input by commas into a list of fixture paths. Verify each file exists.

### Step 1 — Run calibration for each fixture

For each fixture in the list, run `/calibrate-loop` with that fixture path.

- Run them **sequentially** (not in parallel) — each one modifies `rule-config.ts`
- If one fixture fails, log the failure and continue to the next
- Track pass/fail counts

After each fixture, briefly report:
```
[1/6] fixtures/material3-kit.json — Complete
[2/6] fixtures/simple-ds.json — Failed (reason)
```

### Step 2 — Generate aggregate report

After all fixtures are done, build and run the gap report:

```bash
pnpm build
npx canicode calibrate-gap-report --output logs/calibration/REPORT.md
```

### Step 3 — Summary

Report:
- How many fixtures passed/failed
- Where the aggregate report is: `logs/calibration/REPORT.md`
- Remind: "Review the report, then run `/add-rule` when you want to implement a new rule."

## Rules

- Run fixtures sequentially, not in parallel.
- If a fixture fails, continue to the next — don't stop the whole run.
- Each `/calibrate-loop` creates its own run directory under `logs/calibration/`.
- Do NOT modify source files yourself — `/calibrate-loop` handles that via its agent pipeline.
