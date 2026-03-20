/**
 * Built-in documentation for aiready CLI
 */

export function printDocsIndex(): void {
  console.log(`
AIREADY DOCUMENTATION

  aiready docs setup    Full setup guide (CLI, MCP, Skills)
  aiready docs rules    Custom rules guide + example
  aiready docs config   Config override guide + example

Full documentation: github.com/let-sunny/aiready#readme
`.trimStart());
}

export function printDocsSetup(): void {
  console.log(`
AIREADY SETUP GUIDE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 1. CLI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Install:
    npm install -g aiready

  Setup:
    aiready init --token figd_xxxxxxxxxxxxx
    (saved to ~/.aiready/config.json, reports go to ~/.aiready/reports/)

  Use:
    aiready analyze "https://www.figma.com/design/ABC123/MyDesign?node-id=1-234"
    (opens report in browser automatically, use --no-open to disable)

  Data source flags:
    --api     REST API (uses saved token)
    --mcp     Figma MCP bridge (Claude Code only, no token needed)
    (none)    Auto: try MCP first, fallback to API

  Options:
    --preset strict|relaxed|dev-friendly|ai-ready
    --config ./my-config.json
    --custom-rules ./my-rules.json
    --no-open   Don't open report in browser

  Output:
    ~/.aiready/reports/report-YYYY-MM-DD-HH-mm-<filekey>.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 2. MCP SERVER (Claude Code integration)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Route A — Figma MCP relay (no token needed):

    Install (once):
      claude mcp add figma -- npx -y @anthropic-ai/claude-code-mcp-figma
      claude mcp add --transport stdio aiready npx aiready-mcp

    Flow:
      Claude Code
        -> Figma MCP get_metadata(fileKey, nodeId) -> XML node tree
        -> aiready MCP analyze(designData: XML) -> analysis result

  Route B — REST API direct (token needed):

    Install (once):
      claude mcp add --transport stdio aiready npx aiready-mcp
      aiready init --token figd_xxxxxxxxxxxxx

    Flow:
      Claude Code
        -> aiready MCP analyze(input: URL) -> internal REST API fetch -> result

  Use (both routes — just ask Claude Code):
    "Analyze this Figma design: https://www.figma.com/design/..."

  Route A vs B:
    A: No token, 2 MCP servers, Claude orchestrates 2 calls
    B: Token needed, 1 MCP server, aiready fetches directly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 3. CLAUDE SKILLS (lightweight)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Install:
    cp -r path/to/aiready/.claude/skills/aiready .claude/skills/

  Setup (for REST API):
    npx aiready init --token figd_xxxxxxxxxxxxx

  Use (in Claude Code):
    /aiready analyze "https://www.figma.com/design/..."

  Runs CLI under the hood — all flags work (--mcp, --api, --preset, etc.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TOKEN PRIORITY (all methods)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. --token flag (one-time override)
  2. FIGMA_TOKEN env var (CI/CD)
  3. ~/.aiready/config.json (aiready init)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WHICH ONE SHOULD I USE?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  CI/CD, automation        -> CLI + FIGMA_TOKEN env var
  Claude Code, interactive -> MCP Server (Route A)
  No token, Claude Code    -> MCP Server (Route A)
  Quick trial              -> Skills
`.trimStart());
}

export function printDocsRules(): void {
  console.log(`
CUSTOM RULES GUIDE

Custom rules let you add project-specific checks beyond aiready's built-in 39 rules.

STRUCTURE
  - id: unique identifier (kebab-case)
  - category: layout | token | component | naming | ai-readability | handoff-risk
  - severity: blocking | risk | missing-info | suggestion
  - score: negative number (-1 to -15)
  - prompt: what Claude checks for (used in AI-based evaluation)
  - why: reason this matters
  - impact: consequence if ignored
  - fix: how to resolve

EXAMPLE
  [
    {
      "id": "icon-missing-component",
      "category": "component",
      "severity": "blocking",
      "score": -10,
      "prompt": "Check if this node is an icon (small size, vector children, no text) and is not a component or instance.",
      "why": "Icon nodes that are not components cannot be reused consistently.",
      "impact": "Developers will hardcode icons instead of using a shared component.",
      "fix": "Convert this icon node to a component and publish it to the library."
    }
  ]

USAGE
  aiready analyze <url> --custom-rules ./my-rules.json
  See full example: examples/custom-rules.json
`.trimStart());
}

export function printDocsConfig(): void {
  console.log(`
CONFIG GUIDE

Override aiready's default rule scores, severity, and filters.

STRUCTURE
  - excludeNodeTypes: node types to skip (e.g. VECTOR, BOOLEAN_OPERATION)
  - excludeNodeNames: name patterns to skip (e.g. icon, ico)
  - gridBase: spacing grid unit, default 8
  - colorTolerance: color diff tolerance, default 10
  - rules: per-rule overrides (score, severity, enabled)

EXAMPLE
  {
    "excludeNodeTypes": [],
    "excludeNodeNames": [],
    "gridBase": 4,
    "rules": {
      "no-auto-layout": { "score": -15, "severity": "blocking" },
      "raw-color": { "score": -12 },
      "default-name": { "enabled": false }
    }
  }

USAGE
  aiready analyze <url> --config ./my-config.json
  See full example: examples/config.json
`.trimStart());
}

const DOCS_TOPICS: Record<string, () => void> = {
  setup: printDocsSetup,
  install: printDocsSetup, // alias
  rules: printDocsRules,
  config: printDocsConfig,
};

export function handleDocs(topic?: string): void {
  if (!topic) {
    printDocsIndex();
    return;
  }

  const handler = DOCS_TOPICS[topic];
  if (handler) {
    handler();
  } else {
    console.error(`Unknown docs topic: ${topic}`);
    console.error(`Available topics: setup, rules, config`);
    process.exit(1);
  }
}
