import { parseDesignData } from "../src/core/engine/design-data-parser.js";
import { enrichWithDesignContext } from "../src/core/adapters/figma-mcp-adapter.js";
import { analyzeFile } from "../src/core/engine/rule-engine.js";
import { calculateScores, buildResultJson } from "../src/core/engine/scoring.js";
import { readFileSync } from "node:fs";

// MCP metadata XML (collapsed - what get_metadata actually returned)
const mcpXml = '<symbol id="562:11212" name="Platform=Mobile" x="1340" y="20" width="375" height="3258" />';

// MCP design context code
const mcpCode = readFileSync("/tmp/figma-mcp-good.txt", "utf-8");

// Parse XML to AnalysisFile
const file = parseDesignData(mcpXml, "PUNBNLflVnbxKwCSSb6BvK", "Simple Design System");

// Enrich with design context
enrichWithDesignContext(file, mcpCode, "562:11212");

// Count nodes
function countNodes(node: any): number {
  let count = 1;
  for (const child of node.children ?? []) count += countNodes(child);
  return count;
}

const nodeCount = countNodes(file.document);

// Analyze
const result = analyzeFile(file);
const scores = calculateScores(result);

console.log(JSON.stringify({
  nodeCount,
  issueCount: result.issues.length,
  scores: {
    overall: scores.overall,
    categories: scores.byCategory,
  },
  issuesByRule: result.issues.reduce((acc: any, i: any) => {
    acc[i.violation.ruleId] = (acc[i.violation.ruleId] ?? 0) + 1;
    return acc;
  }, {}),
}, null, 2));
