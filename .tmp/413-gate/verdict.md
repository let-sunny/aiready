# #413 Gate Verdict — extend `missing-size-constraint` to height axis?

**Recommendation: (C) No-op / won't-fix. Close with a documented rationale.**

---

## Measurements (24 fixtures, `fixtures/done/*`)

Source data: `.tmp/413-gate/<fixture>/probe.json`, aggregated by `compare.ts` into `report.txt`.

### 1. Fire-rate probe

| Axis of interest | Count across 24 fixtures |
|---|---|
| FRAME/SECTION with `layoutSizingVertical === "FILL"` and no ancestor height bound | **0** |
| INSTANCE with `layoutSizingVertical === "FIXED"` whose parent has Auto Layout | **8** (desktop 4 / mobile 4) |

The `page-container-unbound-height` analogue (parallel to width's dominant subtype) **does not fire once across any of 24 fixtures**. By construction the other page-scope subtype — `page-instance-fixed-height` — has 8 candidate rows.

Width-axis baseline for comparison (`.tmp/403-gate/branch/*`, post-#403): `missing-size-constraint` fires across all 24 fixtures with a meaningful `page-container-unbound` count. The height axis is effectively empty on the dominant subtype.

### 2. Intent-ambiguity classification (all 8 fires sampled — census, not sample)

All 8 INSTANCE-FIXED-height fires are the same component, "Panel Image Double", rendered at `height=478px` as a direct child of the Platform=Desktop/Mobile page root.

| Fixture                 | nodeId        | height | depth | parent (layout)                    | node path                                 | classification          |
|-------------------------|---------------|--------|-------|------------------------------------|-------------------------------------------|-------------------------|
| desktop-about           | 175:4837      | 478px  | 1     | Platform=Desktop (VERTICAL)        | Platform=Desktop > Panel Image Double     | legitimate: media slot  |
| desktop-article         | 175:6761      | 478px  | 1     | Platform=Desktop (VERTICAL)        | Platform=Desktop > Panel Image Double     | legitimate: media slot  |
| desktop-article         | 175:6762      | 478px  | 1     | Platform=Desktop (VERTICAL)        | Platform=Desktop > Panel Image Double     | legitimate: media slot  |
| desktop-landing-page    | 175:6349      | 478px  | 1     | Platform=Desktop (VERTICAL)        | Platform=Desktop > Panel Image Double     | legitimate: media slot  |
| mobile-about            | 562:8444      | 478px  | 1     | Platform=Mobile (VERTICAL)         | Platform=Mobile > Panel Image Double      | legitimate: media slot  |
| mobile-article          | 562:10144     | 478px  | 1     | Platform=Mobile (VERTICAL)         | Platform=Mobile > Panel Image Double      | legitimate: media slot  |
| mobile-article          | 562:10145     | 478px  | 1     | Platform=Mobile (VERTICAL)         | Platform=Mobile > Panel Image Double      | legitimate: media slot  |
| mobile-landing-page     | 562:9796      | 478px  | 1     | Platform=Mobile (VERTICAL)         | Platform=Mobile > Panel Image Double      | legitimate: media slot  |

Classification signals used (per the issue's "Legitimate FIXED height cases" table):

- Component name literally contains "Image" → media / image slot
- Identical fixed height (478px) across desktop and mobile variants → aspect-ratio-driven crop region, not viewport-sized intent
- Used in 3 distinct fixtures by direct insertion → stable library component, not ad-hoc hero section

**Viewport-intent fires: 0/8 (0%).** Legitimate-FIXED fires: 8/8 (100%).

### 3. Overlap with `fixed-size-in-auto-layout`

`.tmp/413-gate/report.txt` §"Overlap": **0 / 8 (0%)**. The 8 INSTANCE-FIXED-height candidates are a distinct node set from the nodes `fixed-size-in-auto-layout` fires on. This means the additive-score rationale from #403's `page-instance-fixed` (width) **cannot be directly recycled** — there is no score-channel overlap to cite.

However, it also means the concern doesn't matter: those 8 nodes are a single reused media component, not a score-channel gap.

### 4. FIXED-height legitimacy taxonomy

| Category (from issue) | Observed count | Example |
|---|---|---|
| Media / aspect slot (16:9, thumbnails, crop) | **8** | "Panel Image Double" 478px, cross-fixture |
| Scroll region before `overflow`                   | 0 | — |
| Sticky bar / one-line chrome (header/footer)      | 0 | — |
| Skeleton / placeholder                            | 0 | — |
| Data-table row                                    | 0 | — |
| Modal / bottom sheet                              | 0 | — |
| Full-viewport hero (gotcha candidate)             | 0 | — |

All 8 FIXED-height fires map to exactly one row of the "legitimate" table. Zero map to the only row the issue flags as "gotcha candidate" (full-viewport hero).

---

## Rationale for (C)

The issue's acceptance criterion is: **≥30% of sampled fires are plausible designer-intent gotchas** → proceed with (A) or (B). The actual rate measured is **0/8 = 0%**, an order of magnitude below the gate.

Three reinforcing reasons:

1. **No page-container-unbound-height signal at all.** The dominant width-axis subtype has no height-axis counterpart on any of 24 fixtures. Shipping a rule whose primary subtype fires zero times is pure noise surface area.

2. **All INSTANCE-FIXED-height candidates are structurally identical** (same component, same height, used as direct children of page roots). This is the archetypal "media / aspect slot" case from the issue's legitimate-FIXED table — flagging it would generate user-facing gotchas for behavior that is correct by design, training users to dismiss the rule.

3. **No score-channel gap exists in practice.** Although overlap with `fixed-size-in-auto-layout` is 0%, that is because the single offending component *is not itself a violation* — the parent Auto Layout owns the height sizing correctly for an aspect-bound image. There is no "missing penalty" the new rule would close.

## Desktop / mobile distribution

The "bimodal distribution" risk flagged in the plan (desktop-heavy viewport-sized sections vs mobile-heavy content-driven height) is not observed. The 8 fires split 4 desktop / 4 mobile, **all identical in shape** (media component). Neither platform shows the patterns a height-axis rule would be designed to catch.

## What (C) means in practice

- Close #413 with a comment citing the numbers above.
- Document the measurement result in the #413 follow-up issue draft (see `followup-issue.md`) as a closure comment rather than an implementation plan.
- Leave `RULE_ANNOTATION_PROPERTIES["missing-size-constraint"]` restricted to `[{ type: "width" }]` as #403 set it.
- Leave ADR-018 amendment as-is — no post-#413 baseline change.
- If future fixtures (e.g. dashboards with fixed-height data tables, mobile chat UIs with fixed footers) surface non-media FIXED-height usage, reopen with new evidence.

## Known limitations of this verdict

- **Fixture bias**: all 24 fixtures come from a single designer / design system. If another design system uses viewport-sized hero sections with explicit FIXED height matching device height, the probe would detect that — but we can't measure it from this corpus alone.
- **Chain walker semantics on height**: we didn't revisit whether `minHeight` / `maxHeight` chain propagation matches width's. The issue explicitly warned against that mirror ("do not mirror the width rule's min/max chain as mandatory"). Since the probe found zero FILL-height containers, the semantic difference is moot for this corpus.
- **Census vs sample**: we sampled all 8 fires, not 20. The planned 20-row sample assumed a larger denominator; with only 8 candidates, the 30% gate is measured against the full population.

## Files committed alongside this verdict

- `.tmp/413-gate/walker-sanity-height.ts` — the per-fixture probe
- `.tmp/413-gate/run-all.sh` — 24-fixture runner
- `.tmp/413-gate/compare.ts` — aggregate reporter
- `.tmp/413-gate/<fixture>/probe.json` (×24) — structured per-fixture output
- `.tmp/413-gate/<fixture>/probe.log` (×24) — console log per run
- `.tmp/413-gate/report.txt` — full compare.ts output snapshot
- `.tmp/413-gate/followup-issue.md` — closure-comment draft (not an implementation plan)
