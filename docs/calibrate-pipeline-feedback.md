# Calibrate Pipeline Feedback

Date: 2026-03-24

## Summary

The calibration pipeline is architecturally sound — clean separation between deterministic steps (Analysis, Evaluation, Tuning) and LLM steps (Converter, Gap Analyzer, Critic, Arbitrator), good Zod contracts, and sensible activity logging. Below are specific issues and improvement suggestions.

---

## Critical Issues

### 1. Two parallel orchestration layers with drift risk

There are two orchestration paths:
- **Programmatic**: `src/agents/orchestrator.ts` → used by `calibrate-run` CLI
- **Prompt-based**: `.claude/commands/calibrate-loop.md` → used by Claude Code

They have significantly diverged:

| Feature | `orchestrator.ts` | `calibrate-loop.md` |
|---------|-------------------|---------------------|
| Conversion | Per-node via `ConversionExecutor` | Whole-design via subagent |
| Gap Analysis | Missing | Yes |
| Critic/Arbitrator debate | Missing | Yes |
| Visual compare | Not integrated | Integrated |

**Impact**: `orchestrator.ts` and `node-conversion-agent.ts` are effectively dead code — the real pipeline runs through the Claude Code command. If someone calls `canicode calibrate-run` directly, they get an incomplete pipeline.

**Suggestion**: Either deprecate/remove the programmatic orchestrator or align it with the full pipeline. The current state will confuse contributors.

### 2. Evaluation agent has systematic overscoring bias

`evaluation-agent.ts:126-149`: When a flagged rule has no corresponding `ruleRelatedStruggle` from the Converter and overall difficulty is easy/moderate, it's classified as `"overscored"` with `actualDifficulty: "easy"`.

```typescript
// Rule was flagged but conversion had no struggle with it
if (difficulty === "easy" || difficulty === "moderate") {
  mismatches.push({
    type: "overscored",
    ...
    actualDifficulty: "easy",  // ← hardcoded to "easy"
```

Problem: The Converter is an LLM that may simply **not mention** a rule in its impact assessment. Missing mention ≠ no impact. This creates systematic downward pressure on all scores over time.

**Suggestion**: Classify as `"validated"` (not `"overscored"`) when a rule has no struggle. Only classify as `"overscored"` when the Converter explicitly says `actualImpact: "easy"` for that rule.

### 3. Size mismatch kills similarity score

`visual-compare.ts:155-173`: When Figma and code screenshots have different dimensions, `similarity` is forced to `0%`. This is too harsh — a 1px height difference shouldn't yield the same score as a completely broken render.

The resize-and-compare logic is already there (for the diff image), but the similarity calculation ignores it:

```typescript
if (raw1.width !== raw2.width || raw1.height !== raw2.height) {
  return {
    similarity: 0,  // ← always 0 for any size mismatch
    ...
  };
}
```

**Suggestion**: After resizing to the larger dimensions, use the actual pixelmatch result for similarity. Apply a small penalty (e.g., -5%) for size mismatch rather than forcing 0%.

---

## Moderate Issues

### 4. calibrate-night convergence check is too aggressive

`calibrate-night.md:39-45`: A fixture is moved to `done/` when `applied=0`. But `applied=0` can mean the Critic rejected valid proposals, not that scores are correct.

**Suggestion**: Require `applied=0 AND rejected=0 AND revised=0` for convergence. Or require two consecutive zero-change runs.

### 5. No regression detection across multi-fixture runs

`calibrate-night` runs fixtures sequentially, each potentially modifying `rule-config.ts`. Fixture 3's changes could break Fixture 1's calibration. There's no mechanism to detect this.

**Suggestion**: After all fixtures complete, re-run evaluation (Step 4 only, no conversion) on all fixtures with the final `rule-config.ts`. Flag any fixture where previously-validated rules become mismatched.

### 6. Tuning agent only uses mode for difficulty aggregation

`tuning-agent.ts:42-59`: `proposedScoreFromDifficulties()` picks the most frequent difficulty. With 2 "easy" and 1 "hard", it proposes -2 (easy midpoint), completely ignoring the hard case.

**Suggestion**: Use worst-case or weighted average instead of mode. At minimum, cap the proposed score so it doesn't go above the range for the worst observed difficulty.

### 7. Critic's 50% change rule creates unnecessary iterations

`critic.md:24`: Rejecting changes >50% of current value means a rule at -10 that should be -2 takes multiple iterations: -10 → -5 → -3 → -2. Each iteration requires a full pipeline run.

**Suggestion**: Use absolute bounds instead (e.g., max 4 points per iteration) or allow large changes when confidence is "high" with 3+ supporting cases.

### 8. Gap Analyzer output lacks schema validation

The Gap Analyzer returns free-form LLM JSON. `gap-rule-report.ts` has to defensively handle multiple naming conventions:

```typescript
// gap-rule-report.ts:61-63
if (typeof raw["coveredByExistingRule"] === "boolean") {
  covered = raw["coveredByExistingRule"];
} else if (raw["coveredByRule"] === true) {
```

**Suggestion**: Define a Zod schema for gap entries (like other contracts) and validate the LLM output. This catches format drift early.

---

## Minor Issues

### 9. Runner agent contradicts orchestrator instructions

`runner.md:18-19`: "Append your report to `$RUN_DIR/activity.jsonl`"

But `calibrate-loop.md:196-197`: "CRITICAL: After each step, append to $RUN_DIR/activity.jsonl yourself. Do NOT rely on subagents to append."

**Suggestion**: Remove the activity.jsonl instruction from `runner.md` to match the orchestrator's design.

### 10. Grade threshold (B+ / 78%) is a cliff

Below 78%, the entire visual comparison is skipped. A design at 77% would still benefit from visual comparison — the threshold creates a binary cliff where 1% grade difference changes the entire pipeline behavior.

**Suggestion**: Make this a gradual degradation. For example, always run visual-compare but weight its signal less for lower grades. Or lower the threshold to C+ (68%).

### 11. Duplicate Playwright browser management

`code-renderer.ts` and `visual-compare.ts` both independently launch and close Chromium. In a full pipeline run, this means 2+ browser launches.

**Suggestion**: Share a browser instance pool or extract a common browser lifecycle utility.

### 12. `renderCodeBatch` in code-renderer.ts appears unused

`renderCodeBatch()` exists for batch rendering but the actual pipeline uses the subagent-based Converter which runs `visual-compare` CLI directly. This function may be dead code.

---

## Architecture Strengths

- Clean deterministic/LLM separation — Steps 1, 4, 7 are pure code, no randomness
- Orchestrator-owns-files pattern — subagents return data, orchestrator writes files
- Gap data accumulation feeds into rule discovery — good long-term feedback loop
- Zod schemas for all core contracts (analysis, evaluation, tuning, conversion)
- Activity.jsonl provides good observability per run
- File-based Figma screenshot caching avoids API rate limits
