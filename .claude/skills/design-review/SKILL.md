---
name: design-review
description: Review Figma designs after edits — auto-analyze with canicode and provide actionable feedback
---

# Design Review — Figma MCP + CanICode

Automatically analyze Figma designs after agent edits (`use_figma`) and provide actionable feedback. Works like a code reviewer for design files.

## Prerequisites

Both MCP servers must be connected:

1. **Figma MCP** (remote) — `https://mcp.figma.com/mcp`
2. **canicode MCP** — `npx -y -p canicode canicode-mcp`

Verify by checking that `mcp__figma__get_metadata` and `mcp__canicode__analyze` are available.

If not connected, show setup:
```
claude mcp add -s project -t http figma https://mcp.figma.com/mcp
claude mcp add -s project canicode -- npx -y -p canicode canicode-mcp
```

## When to Use

Run this skill **after** any `use_figma` call that modifies a Figma design. It acts as a quality gate:

```
Agent edits design (use_figma)
    ↓
/design-review <figma-url>
    ↓
Score OK → proceed
Score dropped or blocking issues → warn user with specific fixes
```

## How It Works

### Step 1: Analyze the design

Use the `/canicode` skill to analyze the Figma URL. This fetches structure via `get_metadata` and styles via `get_design_context`, then runs `canicode analyze`.

### Step 2: Check results

From the analysis output, check:

1. **Blocking issues** (`severity: "blocking"`) — these prevent accurate AI implementation
2. **Overall grade and percentage** — compare with previous score if available
3. **Category breakdown** — identify which dimension degraded

### Step 3: Provide feedback

Format the feedback as a brief summary:

**If blocking issues exist:**
```
Design Review: C+ (72%) — 3 blocking issues found

Blocking:
- no-auto-layout on "Card Container" (Frame 1:234) — add auto-layout for reliable CSS conversion
- raw-color on "Header Text" (Text 1:567) — bind to a color variable/style
- missing-size-constraint on "Hero Image" (Frame 1:890) — set horizontal sizing to Fill or Hug

Fix these before implementing. They directly impact AI code generation accuracy.
```

**If clean:**
```
Design Review: A (87%) — no blocking issues. Ready for implementation.
```

### Step 4: Suggest fixes (if applicable)

For each blocking issue, provide a concrete fix suggestion that could be applied via `use_figma`:

| Rule | Suggested Fix |
|------|--------------|
| `no-auto-layout` | Add vertical/horizontal auto-layout to the frame |
| `raw-color` | Bind fill/stroke to an existing color variable |
| `raw-font` | Bind text style to an existing typography variable |
| `missing-size-constraint` | Set `layoutSizingHorizontal`/`Vertical` to `FILL` or `HUG` |
| `fixed-size-in-auto-layout` | Change fixed dimensions to `FILL` or `HUG` within auto-layout parents |
| `absolute-position-in-auto-layout` | Remove absolute positioning or restructure the layout |

Do NOT auto-apply fixes. Present them to the user and let them decide.

## Tracking Score Changes

If this is a repeated review in the same session, compare with the previous score:

```
Design Review: B+ (81%) — improved from C+ (72%)
  Structure: 75% → 88% (+13%)
  Token: 82% → 82% (unchanged)

Remaining blocking: 1 issue (raw-color on "Status Badge")
```

## Integration with use_figma Workflow

When the user asks to edit a design and review it:

```
User: "Add auto-layout to the card components in this design"
    ↓
1. use_figma → apply auto-layout
2. /design-review → verify improvement
3. Report: "Structure score improved from 65% to 82%. no-auto-layout issues resolved."
```

This creates a tight feedback loop: edit → review → iterate.
