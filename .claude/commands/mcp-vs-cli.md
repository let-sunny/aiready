Run a canicode MCP vs CLI comparison test on the given Figma design.

**Figma URL**: $ARGUMENTS

## Steps

### 0. Pre-check
- If no Figma URL is provided in the arguments, ask the user for one.
- Check if `FIGMA_TOKEN` environment variable is set. If not, ask the user to provide their Figma Personal Access Token before proceeding.
- Extract `fileKey` and `nodeId` from the URL (convert "-" to ":" in nodeId).

### 1. Version check
- Call the canicode MCP `version` tool to confirm the installed version.

### 2. MCP analysis
- Call Figma MCP `get_metadata` with the fileKey and nodeId.
- Call Figma MCP `get_design_context` with the fileKey and nodeId.
- Call canicode MCP `analyze` with:
  - `designData` = get_metadata result
  - `designContext` = get_design_context code output
  - `fileKey` and `fileName` from the Figma file
- Save the full JSON result for comparison.

### 3. CLI analysis
- Run: `FIGMA_TOKEN=<token> npx canicode analyze "<figma-url>" --json`
- Save the full JSON result for comparison.

### 4. Compare and report
- Compare the two JSON results field by field.
- Identify all differences in scores, issue counts, and issuesByRule.
- Investigate the root cause of each discrepancy by examining how the Figma MCP code output (get_design_context) differs from the raw Figma API data.
- Write a markdown report to `reports/mcp-vs-cli-<date>.md` (e.g. `reports/mcp-vs-cli-2026-03-22.md`), including:
  - Overview (test subject, canicode version, Figma URL, node info)
  - Score comparison table (overall + all categories)
  - Issue count comparison table
  - Issues by rule comparison table
  - Root cause analysis for every discrepancy found
  - Data flow diagrams for both MCP and CLI paths
  - Key takeaways and recommendations
  - Report generation date and canicode version
- If the results are identical, note that explicitly in the report.
