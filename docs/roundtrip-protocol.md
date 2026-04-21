# Roundtrip protocol reference (extracted from the skill)

This document holds **override matrices, annotation enum tables, write-policy tiers, pre-flight probe branches, and the bundled-helper catalogue** so \`canicode-roundtrip/SKILL.md\` can stay protocol-focused. The canonical source lives in the repo: edit here or the skill — keep them aligned when changing behaviour.

---

#### Instance-child property overridability (Plugin API)

Most production nodes sit under `INSTANCE` subtrees. `canicode` flags these via `question.isInstanceChild` and, when resolvable, surfaces the definition node id as `question.sourceChildId` plus extra metadata on `question.instanceContext`. You do not need to parse node ids.

Matrix below is confirmed by Experiment 08 ([#290](https://github.com/let-sunny/canicode/issues/290)) probes on shallow + deep instance-child FRAMEs in the Simple Design System fixture. `✅` = raw-value write accepted, `❌` = throws *"cannot be overridden in an instance"*, `⚠️` = no error but value silently unchanged (must detect with before/after compare).

**Per-file caveat:** Cells reflect what Experiment 08 observed on that fixture — another file or component can still land on silent-ignore (`⚠️`) or scene annotation (ADR-012 default) for a property marked `✅` here. Treat the matrix as empirical guidance, not a guarantee for every design.

| Property | Raw-value write on instance child | Variable binding | Notes |
|----------|----------------------------------|------------------|-------|
| `node.name` | ✅ | — | Prefer scene node first. |
| `annotations` | ✅ | — | Good fallback when another property cannot be set. |
| `itemSpacing`, `paddingTop/Right/Bottom/Left` | ✅ | ✅ | |
| `primaryAxisAlignItems`, `counterAxisAlignItems`, `layoutAlign` | ✅ | — | |
| `cornerRadius`, `opacity` | ✅ | ✅ | |
| `fills`, `strokes` (raw color) | ✅ | ✅ via `setBoundVariableForPaint(paint, "color", v)` | |
| `layoutSizingHorizontal` / `layoutSizingVertical` | ✅ | — | |
| `layoutMode` | ⚠️ on some nodes | — | Some instance children silently ignore the write (no throw, no change). |
| **`minWidth`, `maxWidth`, `minHeight`, `maxHeight`** | ❌ on many nodes | **✅** | **Variable binding bypasses the override restriction** — prefer binding when the answer names a token. Raw values route to the definition node after confirmation. |
| `fontSize`, `lineHeight`, `letterSpacing`, `paragraphSpacing` (TEXT) | ✅ | ✅ | |
| `characters` (TEXT) | ✅ | ✅ STRING variable | |

#### Annotation `properties` matrix

Experiment 09 ([#290 follow-up](https://github.com/let-sunny/canicode/issues/290)) re-measured the full 33-value enum on a scene FRAME (`3077:9894`) and scene TEXT (`3077:9963`) in the Simple Design System fixture. The key finding: **the gate is node-type, not scene-vs-instance**. FRAMEs reject `fills`/`cornerRadius`/`opacity`/`maxWidth`/`effects` regardless of context. Instance children additionally lose `minWidth`/`minHeight`/`alignItems` on FRAMEs — these are instance-override restrictions layered on top.

Each row below covers the full 33-value enum (`width`, `height`, `maxWidth`, `minWidth`, `maxHeight`, `minHeight`, `fills`, `strokes`, `effects`, `strokeWeight`, `cornerRadius`, `textStyleId`, `textAlignHorizontal`, `fontFamily`, `fontStyle`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `itemSpacing`, `padding`, `layoutMode`, `alignItems`, `opacity`, `mainComponent`, plus 8 grid props `gridRowGap`/`gridColumnGap`/`gridRowCount`/`gridColumnCount`/`gridRowAnchorIndex`/`gridColumnAnchorIndex`/`gridRowSpan`/`gridColumnSpan`):

| Node type | Accepted (scene) | Additionally rejected on instance child | Rejected in all contexts |
|-----------|------------------|-----------------------------------------|--------------------------|
| FRAME | `width`, `height`, `minWidth`, `minHeight`, `itemSpacing`, `padding`, `layoutMode`, `alignItems` | `minWidth`, `minHeight`, `alignItems` | `maxWidth`, `maxHeight`, `fills`, `strokes`, `effects`, `strokeWeight`, `cornerRadius`, `opacity`, `mainComponent`, all 8 text props, all 8 grid props |
| TEXT | `width`, `height`, `fills`, `textStyleId`, `fontFamily`, `fontStyle`, `fontSize`, `fontWeight`, `lineHeight` | not re-measured — Experiment 08 only probed `strokes`/`opacity`/`cornerRadius`/`effects`/`layoutMode`/`itemSpacing`/`padding` on instance-child TEXT, and all were rejected there too | `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `strokes`, `effects`, `strokeWeight`, `cornerRadius`, `opacity`, `textAlignHorizontal`, `letterSpacing`, `itemSpacing`, `padding`, `layoutMode`, `alignItems`, `mainComponent`, all 8 grid props |

`upsertCanicodeAnnotation` wraps the write in `try/catch`: if `properties` fails node-type validation it retries without them, so the markdown body always survives. You can pass `properties` speculatively.

> **Note:** This policy has shipped per ADR-012 (resolves [#295](https://github.com/let-sunny/canicode/issues/295)): **scene write by default; definition write is opt-in** behind `allowDefinitionWrite`. The bundled helper and the prose below match — reading one without the other is safe.

**Write policy (ordered tiers):**

The helper walks the tiers in order; variable binding is an alternative writeFn shape available at tiers 1 and 2 that bypasses the instance-child override gate (Experiment 08) — it is *not* a separate ordering position between the tiers.

1. **Scene (instance) node** — `await figma.getNodeByIdAsync(question.nodeId)` and apply the write inside `try/catch`. If the answer names a design-system token (`{ variable: "name" }`), the helper calls `setBoundVariable` / `setBoundVariableForPaint` first and that binding bypasses the override gate — otherwise it performs a raw-value write. Success → done (local change only). Mark result with ✅.
2. **Definition (source) node — opt-in only** — Runs only when the orchestrator passes `allowDefinitionWrite: true` on the helper context (after a batch-level confirmation naming the source component AND the propagation set). When the flag is off (the ADR-012 default), a recognized instance-override failure (override-error or silent-ignore) short-circuits here and routes directly to tier 3 — the definition node is never touched. When the flag is on, the helper loads `question.sourceChildId` (or walks `getMainComponentAsync()` if needed) and writes using the same bind-if-token-else-raw shape as tier 1; changes propagate to **every non-overridden instance** in the file (Experiment 10). Mark result with 🌐.
3. **Annotation fallback — default path** — Under the ADR-012 default this is where override-errors and silent-ignores land: the helper annotates the **scene** node with markdown that states whether the failure was a silent-ignore (write ran but value unchanged) or an override-error (Figma rejected the instance write), explains why the source component was not modified by default, and warns that `allowDefinitionWrite: true` propagates to every inheriting instance — not a neutral retry (#443). When `allowDefinitionWrite` is on, this tier also catches any definition-tier throw (e.g. Experiment 10 external-library read-only case, `mainComponent.remote === true` / *"Cannot write to internal and read-only node"*, and the `mainComponent === null` branch where `getMainComponentAsync()` resolves with no definition to name — see Experiment 11 / ADR-011). Either way, mark result with 📝.

**Confirmation is a batch-level concern — and only needed when opting in.** A `use_figma` call runs one JavaScript batch and cannot pause mid-batch for user input. Under the ADR-012 default (`allowDefinitionWrite: false`), no propagation happens, so no confirmation is required — override-errors annotate and move on. The orchestrator sets `allowDefinitionWrite: true` only after enumerating the likely propagation set to the user up-front and collecting **one confirmation for the whole batch** that names the source component(s) and the affected instance set. When describing impact, note that the write reaches every **non-overridden** instance — any instance with a local override for the same property keeps its override. The helper below never prompts — it assumes that if the flag is on, confirmation already happened.

**Pre-flight writability probe (#357).** Before showing the user the Definition write picker, call `CanICodeRoundtrip.probeDefinitionWritability(questions)` inside a small `use_figma` batch. The probe loads every distinct `sourceChildId` once and classifies it as writable or unwritable using the same detection as the runtime fallback (Experiment 10 `remote === true` and Experiment 11 unresolved-`null`). The result decides which version of the picker to show:

```javascript
// Inside a use_figma batch:
const probe = await CanICodeRoundtrip.probeDefinitionWritability(questions);
return { events: [], probe };
```

Branches on `probe`:

- **`allUnwritable === true`** — every candidate source is in an external library (or unresolved). Opting in is structurally a no-op; every write would throw "Cannot write to internal and read-only node" and fall through to scene annotation anyway. Show the user a single-option picker:

  ```
  Definition write policy

  This file's source components live in an external library and are
  read-only from here ({unwritableSourceNames.join(", ")}). Tier 2
  propagation cannot fire — every "opt-in" write would fall through
  to a scene annotation regardless.

  ❯ 1. Annotate only (only viable option for this file)
    2. Cancel — duplicate the library locally first to enable propagation
  ```

  Skip the opt-in branch entirely and call the helpers with the default `allowDefinitionWrite: false`.

- **`partiallyUnwritable === true`** — some sources are local, some remote. Surface the split:

  ```
  Definition write policy

  {unwritableCount} of {totalCount} source components are remote
  (read-only) and will fall through to annotation; the remaining
  {totalCount - unwritableCount} are local and will propagate.
  Remote sources: {unwritableSourceNames.join(", ")}.

  Continue with allowDefinitionWrite: true?
  ```

  When confirmed, propagate to the local sources and let the helper's runtime fallback annotate the remote ones — the existing Experiment-10 retry path absorbs them without aborting the batch.

- **`allUnwritable === false && partiallyUnwritable === false`** (the all-local / no-candidates case) — show the existing batch-level picker prose. No probe-driven adjustment needed.

The probe is read-only and idempotent; running it before the picker adds one round-trip but saves the user a confusing "I opted in, why did I get annotations?" moment that #342 surfaced live on Simple Design System (Community).

**Shared helpers (bundled)** — the deterministic helpers live in TypeScript at `src/core/roundtrip/*.ts` and are bundled to a single IIFE shipped next to this skill as `helpers.js`. `use_figma` only accepts a self-contained JS string, so the source of truth is TypeScript (with vitest coverage) and the bundle is the delivery artifact.

**Usage in a roundtrip session:**

1. Read `helpers.js` from the same directory as this skill once at the start of Step 4 — typically `.claude/skills/canicode-roundtrip/helpers.js` (Claude Code / default `canicode init`) or `.cursor/skills/canicode-roundtrip/helpers.js` (Cursor with `canicode init --cursor-skills`).
2. Prepend its contents verbatim at the top of every `use_figma` batch body — it registers a single global `CanICodeRoundtrip`.
3. Reference exposed globals as `CanICodeRoundtrip.*`:
   - `stripAnnotations(annotations)` — normalizes the D1 label/labelMarkdown mutex on readback.
   - `ensureCanicodeCategories()` — returns `{ gotcha, flag, fallback }` category id map (D4); idempotent, safe to call at the top of every batch. May also include `legacyAutoFix` when the file already carries the pre-#355 `canicode:auto-fix` category from earlier roundtrips — read-only on the canicode side, used only by Step 5 cleanup to sweep old annotations.
   - `upsertCanicodeAnnotation(node, { ruleId, markdown, categoryId, properties })` — idempotent annotation upsert. Handles D1 mutex, D2 in-place replace by ruleId prefix, and the D3 `properties` node-type retry.
   - `applyWithInstanceFallback(question, writeFn, { categories, allowDefinitionWrite, telemetry, roundtripIntent? })` — three-tier write policy with silent-ignore detection. `allowDefinitionWrite` defaults to `false` per ADR-012 — override-errors and silent-ignores annotate the scene naming the source component instead of writing the definition. Set `true` only after a batch-level confirmation. `telemetry` is an optional `(event, props) => void` callback fired when a definition write is skipped (wiring point for future Node-side opt-in usage data). The `writeFn` may return `false` to signal "write accepted but value unchanged" so the helper can route to the next tier. **Annotation category (#444):** `upsertCanicodeAnnotation` uses `categoryId: canicode:fallback` only on the true ADR-012 path (source definition exists, `allowDefinitionWrite: false`, annotate instead of propagating). If the helper annotates because there is no definition, a definition write failed, or a non-override error — use **`canicode:gotcha`** when `roundtripIntent` is passed (survey answer captured), else **`canicode:flag`**. Avoid labeling those cases `fallback` when nothing was fallen back from.
   - `applyPropertyMod(question, answerValue, { categories, allowDefinitionWrite, telemetry })` — Strategy A entry point. Branches on `targetProperty` (single vs array) and answer shape (scalar, per-property object, `{ variable: "name" }` binding). Uses `setBoundVariableForPaint` for `fills` / `strokes` and `setBoundVariable` for scalar fields. Passes the full context through to `applyWithInstanceFallback`.
   - `resolveVariableByName(name)` — local-variable exact-name lookup; returns `null` for remote library variables not imported into this file.
   - `probeDefinitionWritability(questions)` — async pre-flight (#357). Returns `{ totalCount, unwritableCount, unwritableSourceNames, allUnwritable, partiallyUnwritable }`. Use BEFORE the Definition write picker so the picker can drop the opt-in branch when every candidate is in an external library / unresolved (saves the user a wasted "I opted in, why did I get annotations?" decision). Read-only probe, dedupes by `sourceChildId`.
   - `extractAcknowledgmentsFromNode(node, canicodeCategoryIds?)` — synchronous pure helper (#371). Reads one node's annotations and returns `{ nodeId, ruleId }[]` for entries gated by canicode `categoryId` plus a recognisable `— *<ruleId>*` footer (or legacy `**[canicode] <ruleId>**` prefix). When `canicodeCategoryIds` is omitted, footer-text matching alone is sufficient (test mode).
   - `readCanicodeAcknowledgments(rootNodeId, categories?)` — async tree walker (#371). Loads `rootNodeId` via `figma.getNodeByIdAsync`, recurses through `children`, and accumulates one acknowledgment per recognised entry. Used at the top of Step 5a to harvest the side channel that lets the analysis pipeline distinguish "still broken" from "the designer has a plan" — pass the result straight to `analyze({ acknowledgments })`. Errors on individual nodes are swallowed so locked / external nodes don't abort the sweep.
   - `computeRoundtripTally({ stepFourReport, reanalyzeResponse })` — pure helper (#383). Takes the structured Step 4 outcome counts (`{ resolved, annotated, definitionWritten, skipped }`) plus a narrowed re-analyze view (`{ issueCount, acknowledgedCount }`) and returns `{ X, Y, Z, W, N, V, V_ack, V_open }`. Replaces the LLM-side emoji-bullet re-counting in Step 5 — render the returned object directly into the wrap-up templates. Throws when `acknowledgedCount > issueCount` (impossible state).
   - `applyAutoFix(issue, { categories, allowDefinitionWrite?, telemetry? })` — Strategy D entry point (#386). Branches on `targetProperty === "name" && suggestedName` once: renames the node via `applyWithInstanceFallback` (so naming auto-fixes share the same tier-1/2/3 policy as Strategy A) or writes a `categories.flag` annotation carrying `issue.message` and `issue.annotationProperties`. Returns one `AutoFixOutcome` (`{ outcome, nodeId, nodeName, ruleId, label }`) where `outcome` is `🔧` / `🌐` / `📝` so Step 4 can bump the structured `stepFourReport` counters without parsing prose. Replaces the inline JS the SKILL used to carry (per ADR-016).
   - `applyAutoFixes(issues, { categories, allowDefinitionWrite?, telemetry? })` — loop wrapper (#386). Filters `issues` to `applyStrategy === "auto-fix"` (skipped entries surface as `⏭️` outcomes for symmetry) and applies each one in sequence. Returns the full `AutoFixOutcome[]`.
   - `removeCanicodeAnnotations(annotations, categories)` — pure filter. Returns `annotations` with every canicode-authored entry removed (gates on `categories.gotcha` / `flag` / `fallback` / `legacyAutoFix` plus the legacy `**[canicode]` body prefix). Use after `stripAnnotations` in the Step 5 cleanup loop — replaces the inline filter predicate the SKILL used to carry. `isCanicodeAnnotation(annotation, categories)` is the single-entry version, exported for callers that need the predicate alone.

Keep each `writeFn` small so a throw does not abort unrelated writes. Experiment 08 findings informed every branch in the bundled helpers, and the batch-level confirmation contract still applies *when opting in*: if the orchestrator passes `allowDefinitionWrite: true`, it must have already collected one confirmation covering every potential definition write in the batch. Under the default, no confirmation is needed — the helper annotates the scene instead of propagating.

Wrap every property write in `CanICodeRoundtrip.applyWithInstanceFallback(question, async (target) => { ... }, { categories })` so failed or silently-ignored instance overrides route to the scene annotation (or, when the user has opted in, to the definition tier) instead of silently aborting the batch.

