---
name: canicode-gotchas
description: Gotcha survey (Claude Code or Cursor) — Q&A workflow; answers accumulate in .claude/skills/canicode-gotchas/SKILL.md for figma-implement-design
---

# CanICode Gotchas — Design Gotcha Survey

**Channel contrast:** **`canicode-gotchas`** (**this skill**) persists answers **only** in **local** `.claude/skills/canicode-gotchas/SKILL.md` — **memo-only**, no Plugin write to Figma. **`canicode-roundtrip`** writes to the **canvas**. Use gotchas when you want Q&A captured for code-gen context without mutating the file.

Run a gotcha survey on a Figma design to collect implementation context that Figma cannot encode natively, capture developer/designer answers, and upsert them into **`.claude/skills/canicode-gotchas/SKILL.md`** so downstream `figma-implement-design` runs have annotation-ready context. In this model, rules do rule-based best-practice detection, and gotcha is the annotation output from that detection. Some gotchas come from violation rules (what is wrong and how to resolve it); others come from info-collection rules (neutral context Figma cannot represent, like interaction intent/state).

**Install location:** The workflow prose may live under `.claude/skills/canicode-gotchas/SKILL.md` (default `canicode init`) or be copied to `.cursor/skills/canicode-gotchas/SKILL.md` (`canicode init --cursor-skills`). The **authoritative gotcha store** is always **`.claude/skills/canicode-gotchas/SKILL.md`** — the CLI `upsert-gotcha-section` writes there only. In the `.claude` copy, this file has two regions: the **Workflow** below (installed by `canicode init`, never overwritten manually) and the **Collected Gotchas** region at the bottom (one numbered section per design, replaced in place on re-runs).

## Prerequisites

- **canicode MCP** (recommended): Register the server with your host — **Claude Code:** `claude mcp add canicode -- npx --yes --package=canicode canicode-mcp` — long-form flags only; the short-form `-y -p` collides with `claude mcp add`'s parser (#366); do **not** pass `-e FIGMA_TOKEN=…` here (#364). **Cursor / other hosts:** add `canicode-mcp` to your MCP config — see [Customization guide](https://github.com/let-sunny/canicode/blob/main/docs/CUSTOMIZATION.md#cursor-mcp-canicode) (`~/.cursor/mcp.json` or project `.cursor/mcp.json`). The MCP server reads `FIGMA_TOKEN` from `~/.canicode/config.json` or the environment.
- **Without canicode MCP** (fallback): `npx canicode gotcha-survey "<input>" --json` — same JSON shape as the MCP tool.
- **FIGMA_TOKEN** configured for live Figma URLs.
- **Gotcha destination on disk:** `.claude/skills/canicode-gotchas/SKILL.md` must exist before upsert — run `npx canicode init --token …` (add `--cursor-skills` if you also want the workflow file under `.cursor/skills/`).

## Workflow

### Step 0: Verify canicode MCP tools are loaded (optional fast path)

Before Step 1, verify that `gotcha-survey` is callable in **this** session — not merely listed in `.mcp.json`. Newly registered MCP servers usually need a **host restart or MCP reload** before tools appear (same pattern as `/canicode-roundtrip` Step 0 for the Figma MCP).

When you fall back to `npx canicode gotcha-survey … --json`, tell the user explicitly: the canicode MCP may not be loaded yet. They should register it (`claude mcp add canicode -- npx --yes --package=canicode canicode-mcp`, or the Cursor/`mcp.json` equivalent in the Customization guide) and **restart the IDE or reload MCP** — then the next session can use the MCP tool without spawning `npx`. The CLI fallback is correct behavior; silence makes users think registration failed (#433).

### Step 1: Run the gotcha survey

If the `gotcha-survey` MCP tool is available, call it with the user's Figma URL:

```
gotcha-survey({ input: "<figma-url-or-fixture-path>" })
```

**Without canicode MCP** — shell out to the CLI. The `--json` output parses identically:

```bash
npx canicode gotcha-survey "<figma-url-or-fixture-path>" --json
```

Either channel returns:
- `designGrade`: overall grade (S, A+, A, B+, B, C+, C, D, F)
- `isReadyForCodeGen`: whether the design can be implemented without gotchas
- `questions`: array of gotcha questions (may be empty)

### Step 2: Check if survey is needed

If `isReadyForCodeGen` is `true` or `questions` is empty:
- Tell the user: "This design scored **{designGrade}** and is ready for code generation — no gotchas to resolve."
- Do NOT write to `.claude/skills/canicode-gotchas/SKILL.md`.
- Stop here.

### Step 3: Present questions to the user

The survey response carries a pre-computed `groupedQuestions.groups[].batches[]` shape so this skill never has to sort, partition, or maintain a batchable-rule whitelist in prose. The sort key, `_no-source` sentinel, and both batchable-rule lists (`BATCHABLE_RULE_IDS` for `safe` mode, `OPT_IN_BATCHABLE_RULE_IDS` for `opt-in` mode) all live in `core/gotcha/group-and-batch-questions.ts` with vitest coverage (per ADR-016). Iterate over it:

For every `batch` in `groupedQuestions.groups.flatMap((g) => g.batches)`, branch on `batch.batchMode`:

- **`batch.batchMode === "none"`** — single-question batch; the helper guarantees `batch.questions.length === 1`. Render the standard prompt for `batch.questions[0]`:

  ```
  **[{severity}] {ruleId}** — node: {nodeName}

  {question}

  > Hint: {hint}
  > Example: {example}
  ```

- **`batch.batchMode === "safe"` with `batch.questions.length >= 2`** (#369) — rule in `BATCHABLE_RULE_IDS`; one answer is uniformly applicable. Render one shared prompt:

  ```
  **[{severity}] {ruleId}** — {batch.questions.length} instances:
    - {nodeName₁}
    - {nodeName₂}
    - …

  {sharedQuestionPrompt}

  Reply with one answer to apply to all {batch.questions.length}, or **split** to answer each individually.

  > Hint: {hint}
  > Example: {example}
  ```

  Where `sharedQuestionPrompt` reuses the rule's `question` text with the per-node noun replaced by the rule's plural noun (e.g. "These layers all use FILL sizing without min/max constraints. What size boundaries should they share?" instead of repeating the singular phrasing N times).

- **`batch.batchMode === "opt-in"` with `batch.questions.length >= 2`** (#426) — rule in `OPT_IN_BATCHABLE_RULE_IDS` (currently `missing-prototype`). The same answer is usually shareable across siblings but may legitimately differ per node — signal that explicitly so the user can opt out of the shared answer with `split`:

  ```
  **[{severity}] {batch.ruleId}** — {batch.questions.length} instances of the same rule:
    - {nodeName₁}
    - {nodeName₂}
    - …

  {sharedQuestionPrompt}

  Apply this answer to all {batch.questions.length} occurrences of `{batch.ruleId}`, or reply **split** to answer each individually.

  > Hint: {hint}
  > Example: {example}
  ```

  Unlike `safe` batches, the prompt frames the answer as a suggested default, not a uniform truth — reuse the rule's existing `example` (e.g. `missing-prototype`'s "navigates to `/product/{id}` detail page") so the user knows the answer can be a pattern, not a literal string shared character-for-character.

- **Single-member `safe` or `opt-in` batch (`batch.questions.length === 1`)** — render the single-question template above; the shared-prompt framing collapses to the rule's own wording when there is only one node.

Wait for the user's answer before moving to the next batch. The user may:
- Answer the question / batch directly (single value or pattern covers all batch members)
- Say **split** (batch only) to fall back to per-question prompting for that batch — works the same for both `safe` and `opt-in` batches
- Say **skip** to skip the question / the entire batch
- Say **n/a** if the question / the entire batch is not applicable

When applying the batched answer, expand back to per-question records in Step 4 — the gotcha section format stores one record per `nodeId`.

> The `groupedQuestions.groups[].instanceContext` field exists for the `canicode-roundtrip` SKILL's "Instance note" hoist (#370). This skill ignores it — every record gets its own `Instance context` bullet in Step 4 anyway.

### Step 4: Upsert the gotcha section

After collecting all answers, **upsert** this design's section into the `# Collected Gotchas` region at the bottom of:

```
.claude/skills/canicode-gotchas/SKILL.md
```

That path is in the **user's project** (current working directory), NOT in the canicode repo. If you are following this workflow from a copy under `.cursor/skills/`, still upsert into **`.claude/skills/...`** only — never write gotcha answers into the `.cursor` copy. The Workflow region in the `.claude` file **must never be modified manually** — only the `# Collected Gotchas` region is touched (via the CLI below).

#### Step 4a: Use the `designKey` from the survey response

`designKey` uniquely identifies the design so re-running on the same URL replaces the existing section in place. The survey response carries it on `survey.designKey` — read it directly. Do **not** parse the input URL in prose.

The `core/contracts/design-key.ts` helper (`computeDesignKey`) handles every shape with vitest coverage so this workflow stays ADR-016-compliant:

- **Figma URL** → `<fileKey>#<nodeId>` with `-` → `:` normalization on the nodeId. Example: `https://figma.com/design/abc123XYZ/My-File?node-id=42-100&t=ref` → `designKey = "abc123XYZ#42:100"`. Trailing query parameters (`?t=...`, `?mode=...`) are dropped.
- **Figma URL without `node-id`** → just `<fileKey>` (file-level key).
- **Fixture path / JSON file** → absolute path.

#### Step 4b: Upsert via the canicode CLI

File-state detection (4-way: missing / valid / missing-heading / clobbered) and section walking (find existing `## #NNN — ...` by `Design key` substring, otherwise compute the next monotonic zero-padded NNN) are deterministic markdown operations and live in `core/gotcha/upsert-gotcha-section.ts` with vitest coverage — do not re-implement them in prose (per ADR-016).

Build **one JSON object** on stdin for `upsert-gotcha-section`. The CLI renders the section markdown from `survey` + `answers` via `renderGotchaSection` in TypeScript (#439) — severity, rule text, node ids, and instance context come **verbatim** from `gotcha-survey --json`; the skill must not paste LLM-authored section prose.

Payload shape:

```json
{
  "survey": {
    "designKey": "<same as Step 4a>",
    "designGrade": "<from gotcha-survey>",
    "questions": "<full questions[] array from gotcha-survey — preserve order>"
  },
  "answers": {
    "<nodeId>": { "answer": "…" }
  },
  "designName": "<Figma file name or fixture label>",
  "figmaUrl": "<the user's input URL or path>",
  "analyzedAt": "<ISO 8601 timestamp when you upsert>",
  "today": "<YYYY-MM-DD local date for the section title>"
}
```

For skipped / n/a: use `{ "skipped": true }` for that `nodeId`, or omit the key. Skipped questions do **not** get per-question rows; `renderGotchaSection` appends a compact **`#### Skipped (N)`** block listing each `ruleId` with a count (`ruleId` lines sorted lexically — see `src/core/gotcha/render-gotcha-section.ts`).

Invoke (cac requires `--input=-`, not `--input -`, so the stdin sentinel survives parsing — #420):

```bash
npx canicode upsert-gotcha-section \
  --file .claude/skills/canicode-gotchas/SKILL.md \
  --design-key "<designKey from Step 4a>" \
  --input=-
```

Pipe the JSON object on stdin. `--design-key` must equal `survey.designKey` (the CLI validates the match).

The CLI prints JSON `{ state, action, sectionNumber, wrote, userMessage, designKey }`:

- `wrote: true` → success. `action` is `"replace"` (preserved `sectionNumber`) or `"append"` (next monotonic `sectionNumber`).
- `wrote: false` with `state: "missing"` → tell the user: *"Your gotchas SKILL.md is not installed yet. Run `canicode init` first, then re-invoke this skill."* Stop here.
- `wrote: false` with `state: "clobbered"` → tell the user: *"Your gotchas SKILL.md is missing the canicode YAML frontmatter (pre-#340 single-design clobber). Run `canicode init --force` to restore the workflow, then re-run this survey — your answers will land in a clean numbered section."* Stop here.
- `wrote: true` with `state: "missing-heading"` → silent recovery. The CLI injected the `# Collected Gotchas` heading and appended the section; the workflow region above is untouched.

The Workflow region above must never be touched.

## Edge Cases

- **No questions returned**: The design is ready for code generation. Inform the user and stop (Step 2). Do not touch `.claude/skills/canicode-gotchas/SKILL.md`.
- **Re-run on the same design**: Replace that design's section in place (matched by `Design key`) — preserve the original `#NNN` number. Do NOT append a duplicate.
- **Re-run on a different design**: Append a new section with the next `#NNN`. Prior designs' sections are untouched.
- **Workflow region**: Never modified. If you notice the Workflow region has been edited by the user, leave their edits alone — only the `# Collected Gotchas` region is under skill control.
- **Pre-#340 clobbered file** (the YAML frontmatter was rewritten to a per-design variant, so the canonical `canicode-gotchas` frontmatter is missing): tell the user to run `canicode init --force` to restore the workflow, then re-run the survey. The prior single-design content cannot be automatically migrated into a `## #001` section — the user re-runs and gets a clean section.
- **MCP tool not available**: Fall back to `npx canicode gotcha-survey <input> --json` — the CLI returns the same `GotchaSurvey` shape. If the CLI is also unavailable (e.g. no node runtime), tell the user to install the canicode MCP server or the `canicode` npm package (see Prerequisites).
- **Partial answers**: If the user stops mid-survey, upsert the section with answers collected so far. Remaining questions count toward **`#### Skipped (N)`** (omit keys or `{ "skipped": true }`).
- **Manual section deletion**: If the user deletes a middle section by hand, do not renumber existing sections. The next new section still gets `(highest existing number) + 1`; numeric gaps are acceptable (same pattern as `.claude/docs/ADR.md`).

# Collected Gotchas
