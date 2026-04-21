# Closure comment draft for #413

> This is a **closure comment**, not a follow-up issue. The gate measurement returned a (C) verdict (see `.tmp/413-gate/verdict.md`), so no implementation issue is being drafted. If the corpus later grows non-media fixed-height usage, reopen with the new evidence.

---

## Proposed closing comment

Running the acceptance-criteria probe across all 24 `fixtures/done/*` (see `.tmp/413-gate/`):

| Criterion | Result |
|---|---|
| FRAME/SECTION FILL-height containers with no ancestor bound | **0** (across 24 fixtures) |
| INSTANCE FIXED-height in Auto Layout parent | **8** (all the same "Panel Image Double" media component, 478px) |
| Viewport-intent classification rate | **0 / 8 (0%)** — 100% fall into the "media / aspect slot" row of the legitimate-FIXED table |
| Overlap with `fixed-size-in-auto-layout` | 0 / 8 (0%) — distinct node set, but the nodes are correct-by-design (aspect-bound images), not a missing penalty |
| Desktop / mobile split | 4 / 4 — identical shape on both; no platform-specific signal |

The acceptance gate was **≥30% viewport-intent fires to proceed with (A) or (B)**. Actual rate is **0%**, an order of magnitude below.

Closing as **won't fix**. Leaving `RULE_ANNOTATION_PROPERTIES["missing-size-constraint"]` scoped to `[{ type: "width" }]` per #403. ADR-018's post-#403 baseline is unchanged.

If future fixtures surface height-FIXED usage outside the legitimate-FIXED taxonomy (non-media fixed-height data tables, mobile chat UIs with explicit fixed footer height, full-viewport heroes matching device height), reopen this issue with the updated probe output.

### What stays on the table (not being implemented now)

These were noted in the Implementation sketch; they only become relevant if (A) or (B) gets revived by new evidence:

- Shared chain-bound walker extraction (`establishesOwnWidthBound` → `establishesOwnBound(node, axis)`). Width-only walker is fine as-is — no second consumer exists.
- The #412 scoped-out `isModifiable` utility bundle call-out. The trigger (walker-extraction work) hasn't materialized, so `isModifiable` stays deferred to its own separately-motivated issue.
- ADR-018 height amendment. No change to baseline; no edit needed.

### Evidence artifacts

Committed under `.tmp/413-gate/`:

- `walker-sanity-height.ts` — per-fixture probe
- `run-all.sh` + `compare.ts` — 24-fixture runner and aggregate reporter
- `<fixture>/probe.json` × 24 — structured probe output
- `<fixture>/probe.log` × 24 — runner console log
- `report.txt` — compare.ts snapshot
- `verdict.md` — full rationale including per-row classification table
