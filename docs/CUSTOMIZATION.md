# Customization Guide

CanICode supports two types of customization:

1. **Config overrides** — adjust scores, severity, and node exclusions
2. **Custom rules** — add project-specific checks

---

## Config Overrides

Override built-in rule scores, severity, and filter settings with a JSON file.

```bash
canicode analyze <url> --config ./my-config.json
```

### Full Schema

```json
{
  "excludeNodeTypes": ["VECTOR", "BOOLEAN_OPERATION", "SLICE"],
  "excludeNodeNames": ["chatbot", "ad-banner", "custom-widget"],
  "gridBase": 4,
  "colorTolerance": 5,
  "rules": {
    "no-auto-layout": { "score": -15, "severity": "blocking", "enabled": true },
    "raw-color": { "score": -12 },
    "default-name": { "enabled": false }
  }
}
```

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `excludeNodeTypes` | `string[]` | `[]` | Figma node types to skip entirely (node + children) |
| `excludeNodeNames` | `string[]` | `[]` | Name patterns to skip (case-insensitive word match) |
| `gridBase` | `number` | `4` | Spacing grid unit for `inconsistent-spacing` and `magic-number-spacing` |
| `colorTolerance` | `number` | `10` | Color difference tolerance for `multiple-fill-colors` |
| `rules` | `object` | — | Per-rule overrides (see below) |

### Node Exclusions

**`excludeNodeNames`** — Nodes whose name contains any of these words (case-insensitive) will be skipped entirely. The node and all its children are excluded from analysis.

```json
{
  "excludeNodeNames": ["chatbot", "floating-cta", "ad-banner", "legacy"]
}
```

This matches word boundaries, so `"nav"` matches `"Nav Bar"` and `"bottom-nav"` but not `"unavailable"`.

**Built-in exclusions** (always active for conversion candidates):
`icon`, `ico`, `badge`, `indicator`, `image`, `asset`, `chatbot`, `cta`, `gnb`, `navigation`, `nav`, `fab`, `modal`, `dialog`, `popup`, `overlay`, `toast`, `snackbar`, `tooltip`, `dropdown`, `menu`, `sticky`, `bg`, `background`, `divider`, `separator`, `logo`, `avatar`, `thumbnail`, `thumb`, `header`, `footer`, `sidebar`, `toolbar`, `tabbar`, `tab-bar`, `statusbar`, `status-bar`, `spinner`, `loader`, `cursor`, `dot`, `dim`, `dimmed`, `filter`

**`excludeNodeTypes`** — Figma node types to skip.

```json
{
  "excludeNodeTypes": ["VECTOR", "BOOLEAN_OPERATION", "SLICE", "STICKY"]
}
```

Available types: `DOCUMENT`, `CANVAS`, `FRAME`, `GROUP`, `SECTION`, `COMPONENT`, `COMPONENT_SET`, `INSTANCE`, `RECTANGLE`, `ELLIPSE`, `VECTOR`, `TEXT`, `LINE`, `BOOLEAN_OPERATION`, `STAR`, `REGULAR_POLYGON`, `SLICE`, `STICKY`, `TABLE`, `TABLE_CELL`

### Per-Rule Overrides

Override score, severity, or enable/disable individual rules:

```json
{
  "rules": {
    "no-auto-layout": {
      "score": -15,
      "severity": "blocking"
    },
    "default-name": {
      "enabled": false
    }
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `score` | `number` (≤ 0) | Penalty score (more negative = harsher) |
| `severity` | `string` | `"blocking"`, `"risk"`, `"missing-info"`, or `"suggestion"` |
| `enabled` | `boolean` | Set `false` to disable the rule |

### All Rule IDs

**Layout (11 rules)**

| Rule ID | Default Score | Default Severity |
|---------|--------------|-----------------|
| `no-auto-layout` | -7 | blocking |
| `absolute-position-in-auto-layout` | -10 | blocking |
| `fixed-width-in-responsive-context` | -4 | risk |
| `missing-responsive-behavior` | -4 | risk |
| `group-usage` | -5 | risk |
| `fixed-size-in-auto-layout` | -5 | risk |
| `missing-min-width` | -5 | risk |
| `missing-max-width` | -4 | risk |
| `deep-nesting` | -4 | risk |
| `overflow-hidden-abuse` | -3 | missing-info |
| `inconsistent-sibling-layout-direction` | -2 | missing-info |

**Token (7 rules)**

| Rule ID | Default Score | Default Severity |
|---------|--------------|-----------------|
| `raw-color` | -2 | missing-info |
| `raw-font` | -8 | blocking |
| `inconsistent-spacing` | -2 | missing-info |
| `magic-number-spacing` | -3 | missing-info |
| `raw-shadow` | -7 | risk |
| `raw-opacity` | -5 | risk |
| `multiple-fill-colors` | -3 | missing-info |

**Component (6 rules)**

| Rule ID | Default Score | Default Severity |
|---------|--------------|-----------------|
| `missing-component` | -7 | risk |
| `detached-instance` | -5 | risk |
| `nested-instance-override` | -3 | missing-info |
| `variant-not-used` | -3 | suggestion |
| `component-property-unused` | -2 | suggestion |
| `single-use-component` | -2 | suggestion |

**Naming (5 rules)**

| Rule ID | Default Score | Default Severity |
|---------|--------------|-----------------|
| `default-name` | -2 | missing-info |
| `non-semantic-name` | -2 | missing-info |
| `inconsistent-naming-convention` | -2 | missing-info |
| `numeric-suffix-name` | -2 | missing-info |
| `too-long-name` | -1 | suggestion |

**AI Readability (5 rules)**

| Rule ID | Default Score | Default Severity |
|---------|--------------|-----------------|
| `ambiguous-structure` | -10 | blocking |
| `z-index-dependent-layout` | -5 | risk |
| `missing-layout-hint` | -3 | missing-info |
| `invisible-layer` | -10 | blocking |
| `empty-frame` | -2 | missing-info |

**Handoff Risk (5 rules)**

| Rule ID | Default Score | Default Severity |
|---------|--------------|-----------------|
| `hardcode-risk` | -5 | risk |
| `text-truncation-unhandled` | -5 | risk |
| `image-no-placeholder` | -4 | risk |
| `prototype-link-in-design` | -2 | suggestion |
| `no-dev-status` | -2 | suggestion |

### Example Configs

**Strict (for production-ready designs):**
```json
{
  "rules": {
    "no-auto-layout": { "score": -15 },
    "raw-color": { "score": -10, "severity": "blocking" },
    "default-name": { "score": -8, "severity": "blocking" }
  }
}
```

**Relaxed (for early prototypes):**
```json
{
  "excludeNodeNames": ["prototype", "wip", "draft", "temp"],
  "rules": {
    "default-name": { "enabled": false },
    "non-semantic-name": { "enabled": false },
    "missing-component": { "severity": "suggestion" }
  }
}
```

**Mobile-first (focus on layout):**
```json
{
  "rules": {
    "missing-responsive-behavior": { "score": -10, "severity": "blocking" },
    "fixed-width-in-responsive-context": { "score": -8, "severity": "blocking" },
    "no-auto-layout": { "score": -12 }
  }
}
```


---

## Telemetry

CanICode collects anonymous usage analytics via [PostHog](https://posthog.com) and error tracking via [Sentry](https://sentry.io). This helps improve the tool by understanding which features are used and catching errors early.

### What is tracked

- Event names only (e.g. `analysis_completed`, `cli_command`)
- Aggregate metadata: node count, issue count, grade, duration
- Error messages (stack traces for debugging)

### What is NOT tracked

- No design data, file contents, or Figma tokens
- No personally identifiable information
- No file names or URLs

### How to opt out

```bash
canicode config --no-telemetry    # disable telemetry
canicode config --telemetry       # re-enable telemetry
```

Telemetry is enabled by default. When disabled, all monitoring functions become silent no-ops.

### Dependencies

PostHog (`posthog-node`) and Sentry (`@sentry/node`) are optional peer dependencies. If they are not installed, monitoring degrades gracefully with no impact on functionality.
