Run a deep calibration debate loop using Figma MCP for precise design context.

Input: $ARGUMENTS (Figma URL with node-id, e.g. `https://www.figma.com/design/ABC123/MyDesign?node-id=1-234`)

## Instructions

You are the orchestrator. Do NOT make calibration decisions yourself. Only pass data between agents and run deterministic CLI steps.

### Step 0 — Setup

Extract a short name from the URL (fileKey or design name). Create the run directory:

```
RUN_DIR=logs/calibration/<name>--<YYYY-MM-DD-HHMM>/
mkdir -p $RUN_DIR
```

Create `$RUN_DIR/activity.jsonl` and write the first JSON Lines entry:

```json
{"step":"session-start","timestamp":"<ISO8601>","result":"Calibration activity log initialized","durationMs":0}
```

The log uses **JSON Lines format** (one JSON object per line). Each entry has this shape:
```json
{"step":"<StepName>","timestamp":"<ISO8601>","result":"<summary>","durationMs":<ms>}
```

Store the exact `RUN_DIR` path — you will paste it verbatim into every subagent prompt below.

### Step 1 — Analysis (CLI)

```
npx canicode calibrate-analyze "$ARGUMENTS" --run-dir $RUN_DIR
```

Read `$RUN_DIR/analysis.json`. If `issueCount` is 0, stop here.

### Step 2 — Converter

Read the analysis JSON to extract `fileKey`. Parse the root nodeId from the Figma URL.

Spawn a `general-purpose` subagent. In the prompt, include the full converter instructions from `.claude/agents/calibration/converter.md` and add:

```
This is a Figma URL. Use `get_design_context` MCP tool with fileKey and root nodeId.
Figma URL: <paste input URL here>
fileKey: <extracted fileKey>
Root nodeId: <extracted nodeId>
Run directory: <paste RUN_DIR here>
```

The Converter will implement the ENTIRE design as one HTML page and run visual-compare.

### Step 3 — Gap Analysis

Before spawning the Gap Analyzer, check whether the visual-compare screenshots were produced by the Converter:

```bash
test -f $RUN_DIR/figma.png && echo "EXISTS" || echo "MISSING"
```

- **If `$RUN_DIR/figma.png` does NOT exist**: skip Gap Analyzer entirely. Append a warning to `$RUN_DIR/activity.jsonl`:
  ```json
  {"step":"Gap Analyzer","timestamp":"<ISO8601>","result":"SKIPPED — figma.png not found","durationMs":0}
  ```
  Then proceed directly to Step 4.

- **If the file exists**: spawn the `calibration-gap-analyzer` subagent. Provide:
  - Screenshot paths: `$RUN_DIR/figma.png`, `$RUN_DIR/code.png`, `$RUN_DIR/diff.png`
  - Similarity score from the Converter's output
  - Generated HTML path: `$RUN_DIR/output.html`
  - Figma URL
  - Analysis JSON path: `$RUN_DIR/analysis.json`

  ```
  Run directory: <paste RUN_DIR here>
  ```

### Step 4 — Evaluation (CLI)

```
npx canicode calibrate-evaluate _ _ --run-dir $RUN_DIR
```

Read the generated report (`$RUN_DIR/summary.md`), extract proposals. If zero proposals, stop.

### Step 5 — Critic

Spawn the `calibration-critic` subagent. The prompt MUST include:

```
Run directory: <paste RUN_DIR here>
```

### Step 6 — Arbitrator

Spawn the `calibration-arbitrator` subagent. The prompt MUST include:

```
Run directory: <paste RUN_DIR here>
```

### Done

Report the final summary from the Arbitrator.

## Rules

- Each agent must be a SEPARATE subagent call (isolated context).
- Pass only structured data between agents — never raw reasoning.
- The Critic must NOT see the Runner's or Converter's reasoning, only the proposal list.
- Only the Arbitrator may edit `rule-config.ts`.
- Steps 1 and 4 are CLI commands — run them directly with Bash.
- **CRITICAL**: Every subagent prompt MUST contain the exact RUN_DIR path. Do NOT use placeholders. Paste the actual path string.
