# Research Report: Calibration & Rule Discovery (Branch `fix/calibration-pipeline-issue-14`)

**Scope:** Deep technical review of CanICode’s internal calibration and rule-discovery pipelines as reflected on the current branch, including recent fixes for retina-aligned visual comparison, cross-run evidence handling, and convergence semantics for nightly workflows.

**Audience:** Maintainers opening or reviewing PRs that touch `visual-compare`, agent orchestration, or calibration CLI commands.

---

## 1. Executive summary

CanICode’s north star is answerable in one question: **can AI implement a scoped Figma design pixel-accurately?** **Calibration** grounds rule **scores** in measured conversion difficulty (including **visual-compare** similarity). **Rule discovery** turns recurring **gap** patterns into new rules, validated by A/B visual runs.

On this branch, three themes stand out as materially improving scientific validity and operator ergonomics:

1. **Retina / export-scale alignment** — Figma exports and Playwright captures now share the same physical pixel grid by default (`figmaExportScale`, inferred logical viewport, `deviceScaleFactor`). This removes a large class of false “diff” signals that previously looked like design errors.
2. **Calibration evidence hygiene** — Appending calibration evidence **replaces** the prior row for the same `(ruleId, fixture)` pair so the cross-run store reflects the **latest** assessment, not an unbounded pile of contradictory rows.
3. **Convergence for automation (issue #14)** — Strict convergence (`no applied/revised` **and** `no rejected`) is correct for “the debate fully settled.” For nightlies, **`--lenient-convergence`** allows `fixture-done` when the Arbitrator applied nothing but still logged rejections—a common pattern when the Critic repeatedly blocks borderline proposals while scores are stable.

The branch also carries substantial **fixture expansion** (calibrated designs moved under `fixtures/done`, new fixture JSON/screenshots). That increases empirical coverage but increases repo size and CI time—trade-offs called out in Section 8.

---

## 2. System map

### 2.1 Channels vs internal pipelines

| Surface | Role in the metric story |
|--------|---------------------------|
| CLI `analyze` | Produces rule findings and scores from structure/fixture JSON |
| CLI `visual-compare` | Measures **pixel** similarity between Figma PNG and rendered HTML |
| MCP / skill | Same analysis with optional hybrid enrichment from Figma MCP |
| **`/calibrate-loop`** (Claude Code) | Full loop: analyze → convert whole scope → gap analysis → evaluate → critic → arbitrator |
| **`/add-rule`** | Research → implement rule → A/B visual → critic decision |
| **`/calibrate-night`** | Sequential calibration + `fixture-list` / `fixture-done` + aggregate gap report |

### 2.2 Artifact graph

```
fixtures/<name>/data.json (+ screenshot.png)
        │
        ▼
  calibrate-analyze ──► analysis.json (run dir)
        │
        ▼
  Converter + visual-compare ──► conversion.json, figma.png, code.png, diff.png
        │
        ▼
  Gap analyzer ──► gaps.json ──► discovery-evidence (filtered) + gap-rule-report
        │
        ▼
  calibrate-evaluate ──► proposals + calibration-evidence (overscore/underscore)
        │
        ▼
  debate.json (critic + arbitrator) ──► rule-config.ts edits, calibrate-prune-evidence
```

### 2.3 Cross-run stores

| File | Content | Pruned when |
|------|---------|-------------|
| `data/calibration-evidence.json` | Per-rule overscored/underscored signals | `calibrate-prune-evidence` after applied/revised rules |
| `data/discovery-evidence.json` | Missing-rule / gap signals | `discovery-prune-evidence` after a category is addressed |

Orchestrator-side **noise filters** (regex) prevent font CDN, retina/DPI, screenshot dimension, network, and CI noise from polluting discovery evidence—keeping the Researcher’s input **actionable**.

---

## 3. Branch-specific technical analysis

### 3.1 Visual comparison: scale and padding

**Problem (historical):** Comparing a `@2x` Figma PNG to a `1×` Playwright screenshot inflated diff pixels and **compressed similarity**, biasing calibration toward “everything is hard” and muddying gap labels.

**Current behavior:**

- Default **`figmaExportScale`** of `2` matches common REST exports and **`save-fixture`** output.
- Without an explicit viewport, **logical** width/height = PNG dimensions ÷ export scale; Playwright uses **`deviceScaleFactor`** = export scale so **`code.png`** matches **`figma.png`** in device pixels.
- With explicit `--width` / `--height`, **`inferDeviceScaleFactor`** reconciles PNG aspect ratio to logical viewport using rounded ratios with small tolerance—guarding against odd sizes.

**Size mismatch handling:** Images are **padded** with a high-contrast magenta fill to a common canvas (not resized). That choice is deliberate:

- Resampling would blend pixels and **hide** misalignment.
- Padding makes “extra” area unambiguously wrong in **pixelmatch**, which is what you want for calibration (layout bounds matter).

**CLI parity:** `canicode visual-compare` exposes `--figma-scale` and documents inference behavior in `canicode docs visual-compare`.

### 3.2 Calibration evidence: last-write-wins per fixture

`appendCalibrationEvidence` builds a key `ruleId + NUL + fixture`. Existing entries with those keys are **removed** before new entries are appended. Effects:

- **Pros:** Stops double-counting stale runs; `loadCalibrationEvidence` aggregates reflect the latest truth per fixture.
- **Cons:** Deliberate historical audit of every run is **not** preserved in this file (only in per-run logs). If longitudinal studies are needed, append-only logs under `logs/calibration/` remain the source of truth.

**Discovery evidence** remains append-only (no dedupe)—appropriate for “many distinct gaps,” but can grow large; see recommendations.

### 3.3 Convergence: strict vs lenient

| Mode | Condition | Use case |
|------|-----------|----------|
| **Strict** (default) | `applied === 0` **and** `revised === 0` **and** `rejected === 0` | True “quiet” arbitration: no pending controversy |
| **Lenient** | `applied === 0` **and** `revised === 0` (rejects ignored) | Stable scores but Critic still rejecting proposals; unblocks `fixture-done` / nightlies |

**Skipped debates** (`debate.skipped`) count as converged—zero proposals is a valid terminal state.

**Operational note:** Lenient mode should be paired with **human review** of `debate.json` periodically; otherwise rejected-but-valid signals might never drive config change.

---

## 4. Rule discovery pipeline (conceptual depth)

### 4.1 Inputs

- **Gap JSON** per calibration run (categories, descriptions, `actionable`, `coveredByExistingRule`).
- **Accumulated discovery evidence** (evaluation + gap-analysis sources).
- **Fixture diversity** — done vs active fixtures under `fixtures/` and `fixtures/done/`.

### 4.2 Weak links (inherent)

1. **A/B tests proxy “missing metadata”** with AI-generated text—signal is “does extra structured data help the converter?” not “does human copy help?”
2. **Gap analyzer** depends on diff interpretation; anti-aliasing and font substitution still create **baseline** noise (~few percent similarity) even after retina alignment.
3. **Critic/Arbitrator** are LLM-mediated; deterministic steps (`runEvaluationAgent`, gap aggregation) are sound, but final commits are governance-sensitive.

---

## 5. Evaluation: what is working well

1. **Clear separation of concerns:** Rule **logic** vs **`rule-config.ts`** scores enables tuning without rewriting detectors.
2. **Deterministic evaluation agent:** Maps difficulties to score bands transparently—easy to test and to explain in reports.
3. **Filtering conversion candidates** (large files): Frames/components with minimum size, child count, text descendants—reduces “icon noise” that once split signals for rules like `no-auto-layout`.
4. **GapRuleReport** bridges many `gaps.json` files into markdown suitable for human triage.
5. **Test coverage** around evidence, run directories, and visual-compare numerics gives confidence in refactors.

---

## 6. Risks and limitations

| Risk | Impact | Mitigation (existing or proposed) |
|------|--------|-----------------------------------|
| Fixture/repo bloat | Clone and CI slower | Submodules or LFS for `data.json` + PNG; or slim “CI fixtures” subset |
| Discovery evidence growth | Slower loads; noisy Researcher context | Category-level caps, dedupe by hash of description, archival files |
| Single global `rule-config` | Cross-fixture coupling | Per-preset configs or weighted calibration per vertical (longer-term) |
| Playwright `networkidle` + fixed 1s wait | Flaky or slow compares | Tunable wait strategy; opt-in `domcontentloaded` for static HTML |
| Magenta padding | Extreme edge cases might collide with design | Extremely rare; could switch to XOR mask in diff only |

---

## 7. Improvement roadmap (prioritized)

### P0 — Trust and reproducibility

- **Pin a “golden” visual-compare fixture** in CI (small HTML + canned PNG) so scale/padding logic cannot regress silently without network.
- **Emit `figmaExportScale` and inferred `deviceScaleFactor` into `conversion.json`** for every run dir—makes postmortems one glance.

### P1 — Evidence and discovery

- **Optional dedupe** for `discovery-evidence.json` (e.g., normalized description + category) with max entries per category.
- **Schema version** field on evidence arrays for forward-compatible migrations.

### P2 — Operator UX

- **`fixture-done --dry-run`** printing convergence reason (strict fail: N rejects, M applies).
- **Single command** wrapping “latest run dir for fixture X” resolution—today paths are manual.

### P3 — Analytical depth

- **Per-rule elasticity:** How much similarity improves when a rule is “turned off” in synthesis vs “fixed” in Figma—connects scores to **marginal** visual delta.
- **Confound controls:** Blank fixture with only text + one rectangle to measure pure font/smoothing baseline per OS.

### P4 — Documentation

- Keep **`docs/CALIBRATION.md`** narrative; this document is the **engineering appendix** for branch-level decisions.

---

## 8. Fixture strategy assessment

Moving calibrated sets to **`fixtures/done/`** is a strong workflow signal: *this design has been through the loop.* Risks:

- **Discoverability:** New contributors may not know `done/` is intentional historical corpus.
- **Size:** JSON artifacts dominate diff noise; consider policy: “active small fixtures in repo; large kits documented + downloaded.”

Recommendation: document in `CLAUDE.md` or `fixtures/README.md` (when the team chooses to add it) a one-paragraph **fixture lifecycle**: active → calibrate → done → optional archive.

---

## 9. Conclusion

The branch advances the project from “we compare screenshots” to **comparisons that respect how Figma and browsers actually rasterize**. Together with **evidence dedupe** and **lenient convergence**, it closes practical gaps that otherwise waste arbitrators’ time or stall nightlies—without abandoning strict mode for runs that demand full closure.

The next leap is not more rules by count, but **tighter coupling between visual deltas and marginal rule importance** (P3), so `rule-config.ts` continues to track measurable implementation pain rather than narrative severity alone.

---

## 10. Reference pointers (code)

- Visual pipeline: `src/core/engine/visual-compare.ts`
- CLI wiring: `src/cli/index.ts` (`visual-compare`, `fixture-done`)
- Convergence: `src/agents/run-directory.ts` (`isConverged`, `ConvergenceOptions`)
- Evidence: `src/agents/evidence-collector.ts`
- Noise filters + orchestration: `src/agents/orchestrator.ts` (`ENVIRONMENT_NOISE_PATTERNS`)
- Nightly note: `.claude/commands/calibrate-night.md`
