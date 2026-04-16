---
name: canicode-roundtrip
description: Analyze Figma design, fix gotchas via Plugin API, re-analyze, then implement — true design-to-code roundtrip
disable-model-invocation: false
---

# CanICode Roundtrip — True Design-to-Code Roundtrip

Orchestrate the full design-to-code roundtrip: analyze a Figma design for readiness, collect gotcha answers for problem areas, **apply fixes directly to the Figma design** via `use_figma`, re-analyze to verify the design improved, then generate code. The design itself gets better — the next analysis passes without gotchas.

## Prerequisites

- **Figma MCP server** installed (provides `get_design_context`, `get_screenshot`, `use_figma`, and other Figma tools)
- **canicode MCP server** installed: `claude mcp add canicode -e FIGMA_TOKEN=figd_xxx -- npx -y -p canicode canicode-mcp`
- **FIGMA_TOKEN** configured for live Figma URLs
- **Figma Full seat + file edit permission** (required for `use_figma` to modify the design)

## Workflow

### Step 1: Analyze the design

Call the `analyze` MCP tool with the user's Figma URL:

```
analyze({ input: "<figma-url>" })
```

The response includes:
- `scores.overall.grade`: design grade (S, A+, A, B+, B, C+, C, D, F)
- `isReadyForCodeGen`: boolean gate for gotcha skip
- `issues`: array of design issues found
- `summary`: human-readable analysis summary

Show the user a brief summary:

```
Design grade: **{grade}** ({percentage}%) — {issueCount} issues found.
```

### Step 2: Gate — check if gotchas are needed

If `isReadyForCodeGen` is `true` (grade S, A+, or A):
- Tell the user: "This design scored **{grade}** — ready for code generation with no gotchas needed."
- Skip directly to **Step 6**.

If `isReadyForCodeGen` is `false` (grade B+ or below):
- Tell the user: "This design scored **{grade}** — running gotcha survey to identify implementation pitfalls."
- Proceed to **Step 3**.

### Step 3: Run gotcha survey and collect answers

Call the `gotcha-survey` MCP tool:

```
gotcha-survey({ input: "<figma-url>" })
```

If `questions` is empty, skip to **Step 6**.

For each question in the `questions` array, present it to the user one at a time:

```
**[{severity}] {ruleId}** — node: {nodeName}

{question}

> Hint: {hint}
> Example: {example}
```

Wait for the user's answer before moving to the next question. The user may:
- Answer the question directly
- Say "skip" to skip a question
- Say "n/a" if the question is not applicable

After all questions are answered, **save gotcha answers to file** at `.claude/skills/canicode-gotchas/SKILL.md` in the user's project. Always overwrite any existing file — each run produces a fresh file. Follow the format from the `/canicode-gotchas` skill.

Then proceed to **Step 4** to apply answers to the Figma design.

### Step 4: Apply gotcha answers to Figma design

Extract the `fileKey` from the Figma URL (format: `figma.com/design/:fileKey/...`).

For each answered gotcha (skip questions answered with "skip" or "n/a"), determine the apply strategy based on the `ruleId`:

#### Strategy A: Property Modification — apply directly

These rules have straightforward property changes. Apply without additional confirmation. Parse the user's answer to extract the target values.

**`non-semantic-name`** — Rename the node to the answer:
```javascript
const node = figma.getNodeById("nodeId");
if (node) node.name = "hero-section";
```

**`irregular-spacing`** — Fix spacing to the grid-aligned value from the answer:
```javascript
const node = figma.getNodeById("nodeId");
if (node && "itemSpacing" in node) node.itemSpacing = 16;
// For padding: node.paddingTop = 8; node.paddingBottom = 8; etc.
```

**`fixed-size-in-auto-layout`** — Change sizing mode per the answer (FILL, HUG, or FIXED):
```javascript
const node = figma.getNodeById("nodeId");
if (node && "layoutSizingHorizontal" in node) {
  node.layoutSizingHorizontal = "FILL"; // or "HUG" or "FIXED"
}
```

**`missing-size-constraint`** — Set min/max constraints from the answer:
```javascript
const node = figma.getNodeById("nodeId");
if (node && "minWidth" in node) {
  node.minWidth = 320;  // from answer
  node.maxWidth = 1200; // from answer, if provided
}
```

**`no-auto-layout`** — Set layout mode, direction, and spacing from the answer:
```javascript
const node = figma.getNodeById("nodeId");
if (node && "layoutMode" in node) {
  node.layoutMode = "VERTICAL"; // or "HORIZONTAL"
  node.itemSpacing = 16;
  // Optionally set padding, alignment from the answer
}
```

#### Strategy B: Structural Modification — confirm with user first

These rules change the design structure. Show the proposed change and **ask for user confirmation** before applying.

**`non-layout-container`** — Convert Group/Section to Auto Layout frame:
- Prompt: "I'll convert **{nodeName}** to an Auto Layout frame with {direction} layout and {spacing}px gap. Proceed?"
- If confirmed:
```javascript
const node = figma.getNodeById("nodeId");
if (node && "layoutMode" in node) {
  node.layoutMode = "VERTICAL";
  node.itemSpacing = 12;
}
```

**`deep-nesting`** — Flatten intermediate wrappers or extract sub-component:
- Prompt: "I'll flatten **{nodeName}** by {description from answer}. This changes the layer hierarchy. Proceed?"
- Apply based on the specific answer (remove wrappers, convert padding, etc.)

**`missing-component`** — Convert frame to reusable component:
- Prompt: "I'll convert **{nodeName}** to a reusable component. Proceed?"
- If confirmed:
```javascript
const node = figma.getNodeById("nodeId");
if (node && node.type === "FRAME") {
  figma.createComponentFromNode(node);
}
```

**`detached-instance`** — Reconnect to original component:
- Prompt: "I'll reconnect **{nodeName}** to its original component. Any overrides will be preserved. Proceed?"
- This requires finding the original component — if not identifiable, fall back to annotation.

If user **declines** any structural modification, add an annotation instead (same as Strategy C).

#### Strategy C: Annotation — record on the design for designer reference

These rules cannot be auto-fixed via Plugin API. Add the gotcha answer as a Figma annotation on the node so designers see it in Dev Mode.

**Rules from gotcha survey**: `absolute-position-in-auto-layout`, `variant-structure-mismatch`

```javascript
const node = figma.getNodeById("nodeId");
if (node && "annotations" in node) {
  node.annotations = [...(node.annotations || []), {
    labelMarkdown: "**[canicode] {ruleId}**\n\n**Q:** {question}\n**A:** {answer}"
  }];
}
```

Important: use `labelMarkdown` only — `label` and `labelMarkdown` are mutually exclusive. Preserve existing annotations by spreading `node.annotations`.

#### Strategy D: Auto-fix lower-severity issues from analysis

The gotcha survey only covers blocking/risk severity (11 rules). The remaining 5 rules appear in the Step 1 analysis `issues` array but not in the survey. Process them directly — no gotcha question needed.

**Auto-fix naming** — apply directly from the analysis issue data:

**`non-standard-naming`** — The analysis identifies non-standard state names. Rename to the standard equivalent:
```javascript
const node = figma.getNodeById("nodeId");
if (node) node.name = "Hover"; // standardize from "hover_v1", "on_hover", etc.
```
Standard state names: Default, Hover, Active, Pressed, Selected, Highlighted, Disabled, Enabled, Focus, Focused, Dragged.

**`inconsistent-naming-convention`** — The analysis identifies the dominant convention among siblings. Rename minority nodes to match:
```javascript
const node = figma.getNodeById("nodeId");
if (node) node.name = "CardTitle"; // convert to dominant convention (e.g., PascalCase)
```

**Annotate** — these require designer judgment, no auto-fix possible:

**`raw-value`** — Raw colors/fonts/spacing without design tokens. Annotate which values need token binding:
```javascript
node.annotations = [...(node.annotations || []), {
  labelMarkdown: "**[canicode] raw-value**\n\nThis node uses raw values without design tokens.\n**Issue:** {issue message from analysis}"
}];
```

**`missing-interaction-state`** — Missing hover/active/disabled variants. Annotate what states are needed:
```javascript
node.annotations = [...(node.annotations || []), {
  labelMarkdown: "**[canicode] missing-interaction-state**\n\nThis component is missing interaction state variants.\n**Missing:** {missing states from analysis}"
}];
```

**`missing-prototype`** — Missing prototype interactions (rule currently disabled, include for completeness):
```javascript
node.annotations = [...(node.annotations || []), {
  labelMarkdown: "**[canicode] missing-prototype**\n\nThis interactive element has no prototype interaction defined.\n**Expected:** {expected interaction from analysis}"
}];
```

#### Execution order

1. **Batch all property modifications** (Strategy A) into a single `use_figma` call for efficiency.
2. **Present structural modifications** (Strategy B) one by one, apply confirmed ones.
3. **Batch all annotations** (Strategy C + declined structural mods) into a single `use_figma` call.
4. **Batch all auto-fixes and annotations for lower-severity issues** (Strategy D) into a single `use_figma` call.

After applying, report what was done:

```
Applied {N} changes to the Figma design:
- ✅ {nodeName}: renamed to "hero-section" (non-semantic-name)
- ✅ {nodeName}: itemSpacing → 16px (irregular-spacing)
- ⏭️ {nodeName}: declined by user, added annotation (deep-nesting)
- 📝 {nodeName}: annotation added (absolute-position-in-auto-layout)
- 🔧 {nodeName}: auto-fixed to "Hover" (non-standard-naming)
- 📝 {nodeName}: annotation — raw color needs token binding (raw-value)
```

### Step 5: Re-analyze and verify

Run `analyze` again on the same Figma URL:

```
analyze({ input: "<figma-url>" })
```

Compare the new grade with the original:

**All gotcha issues resolved** (new grade is S, A+, or A):
- Tell the user: "Design improved from **{oldGrade}** to **{newGrade}** — all gotcha issues resolved. Ready for code generation."
- Clean up canicode annotations: remove annotations with `[canicode]` prefix from fixed nodes via `use_figma`:
```javascript
const nodeIds = ["id1", "id2"]; // nodes that now pass
for (const id of nodeIds) {
  const node = figma.getNodeById(id);
  if (node && "annotations" in node) {
    node.annotations = (node.annotations || []).filter(
      a => !a.labelMarkdown?.startsWith("**[canicode]")
    );
  }
}
```
- Proceed to **Step 6**.

**Some issues remain**:
- Show what improved and what still needs attention.
- Ask: "Design improved from **{oldGrade}** to **{newGrade}**. {remainingCount} issues remain. Proceed to code generation?"
- If yes → proceed to **Step 6** with remaining gotcha context.
- If no → stop and let the user address remaining issues manually.

### Step 6: Implement with Figma MCP

Follow the **figma-implement-design** skill workflow to generate code from the Figma design.

**If annotations or unresolved gotchas remain from Step 5**, provide them as additional context when implementing:

- Gotchas with severity **blocking** MUST be addressed — the design cannot be implemented correctly without this information
- Gotchas with severity **risk** SHOULD be addressed — they indicate potential issues that will surface later
- Reference the specific node IDs from gotcha answers to locate the affected elements in the design

**If all issues were resolved in Steps 4-5**, no additional gotcha context is needed — the design speaks for itself.

## Edge Cases

- **No canicode MCP server**: If the `analyze` tool is not found, tell the user to install the canicode MCP server (see Prerequisites). The Figma MCP tools alone are not sufficient for this workflow.
- **No Figma MCP server**: If `get_design_context` or `use_figma` is not found, tell the user to set up the Figma MCP server. Without it, the apply and code generation phases cannot proceed.
- **No edit permission**: If `use_figma` fails with a permission error, tell the user they need Full seat + file edit permission. Fall back to the one-way flow: skip Steps 4-5 and proceed directly to Step 6 with gotcha answers as code generation context.
- **User wants analysis only**: Suggest using `/canicode` instead — it runs analysis without the code generation phase.
- **User wants gotcha survey only**: Suggest using `/canicode-gotchas` instead — it runs the survey and saves answers as a persistent skill file.
- **Partial gotcha answers**: Apply only the answered questions. Skipped/n/a questions are neither applied nor annotated.
- **use_figma call fails for a node**: Report the error for that specific node, continue with other nodes. Failed property modifications become annotations so the context is not lost.
- **Re-analyze shows new issues**: Only address issues from the original gotcha survey. New issues may appear due to structural changes — report them but do not re-enter the gotcha loop.
- **Very large design (many gotchas)**: The gotcha survey already deduplicates sibling nodes and filters to blocking/risk severity only. If there are still many questions, ask the user if they want to focus on blocking issues only.
