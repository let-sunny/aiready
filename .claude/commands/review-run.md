Review a completed /develop pipeline run and provide a structured QA assessment.

Input: $ARGUMENTS (run directory path, e.g. `logs/develop/253--2026-04-16-0903`)

## Instructions

### Step 1 — Pipeline Overview

Read `$ARGUMENTS/index.json` and summarize:
- Issue number, title, branch
- Pipeline status (completed / failed / partial)
- Each step's status, duration, and retry count
- Total pipeline duration

If index.json is missing, stop and report: "Not a valid run directory."

### Step 2 — Plan Quality

Read `$ARGUMENTS/plan.json` and assess:
- Are the tasks well-scoped and aligned with the issue?
- Are designDecisions reasonable and well-justified?
- Are risks identified and realistic?
- Does `split` / `remainingDescription` make sense for the issue size?

### Step 3 — Implementation Review

Read `$ARGUMENTS/implement-log.json` for decisions and knownRisks.
Read `$ARGUMENTS/implement-output.txt` for agent output context.

Then run the actual diff to see what changed:
```bash
git diff main...<branch>
```
Use the `branch` field from index.json. If the branch no longer exists (e.g., merged and deleted), note this and skip the diff.

Assess:
- Do the changes match the plan's tasks?
- Are the implementer's decisions sound?
- Are the knownRisks legitimate concerns?
- Does the diff look clean — no unrelated changes, no leftover debug code?

### Step 4 — Test Results

Read `$ARGUMENTS/test-result.json` (may not exist if test was skipped).

If it exists, check whether lint and tests passed or what failed.

### Step 5 — Self-Review Findings

Read `$ARGUMENTS/review.json` and assess:

- Is the review verdict reasonable given the findings?
- Are the findings legitimate issues or false positives?
- Did the reviewer catch the implementer's knownRisks?
- Are intentConflict flags used correctly?

### Step 6 — Fix Coverage

Read `$ARGUMENTS/fix-log.json` (may not exist if fix was skipped).

If it exists, assess:
- Did the fixer address all review findings?
- For skipped findings: are the skip reasons justified?
- Did the fix introduce any new concerns?

### Step 7 — Verify State

Read `$ARGUMENTS/circuit.json` (may not exist if verify was skipped).

If it exists, check:
- Did verify pass cleanly (errorCount = 0)?
- Were retries needed? If so, what failed?
- Was a re-plan attempted?

### Step 8 — Final Verdict

Synthesize all findings into a structured assessment:

```
## Pipeline Run Review: <issue-title> (#<issue-number>)

### Overview
- **Status**: ...
- **Branch**: ...
- **Duration**: ...
- **Steps**: X/7 completed

### Plan Assessment
(1-2 sentences)

### Implementation Assessment
(Key observations about the diff and decisions)

### Review & Fix Assessment
(Were findings valid? Were fixes adequate?)

### Concerns
(List any issues found, or "None")

### Verdict: APPROVE / REQUEST-CHANGES
(1-2 sentence justification)
```

## Rules

- Read each file before assessing it — do not assume contents.
- Handle missing files gracefully — some steps may have been skipped or failed.
- If the diff is very large (100+ files), summarize by area instead of reviewing line-by-line.
- Focus on whether the pipeline produced correct, well-reasoned output — not on re-doing the review.
- The verdict is your independent judgment. A pipeline "approve" doesn't mean you must approve.
