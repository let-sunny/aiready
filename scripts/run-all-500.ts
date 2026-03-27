import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderCodeScreenshot } from "../src/core/engine/visual-compare.js";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";

const RUN_DIR = "logs/ablation/04-viewport-test";
const GROUND_TRUTH = resolve(RUN_DIR, "images/figma-500px-ground-truth.png");

const TESTS = [
  { name: "dt-good", html: "logs/ablation/experiment-large--2026-03-27/ablation-large-good.html", strip375: true },
  { name: "dt-bad-structure", html: "logs/ablation/experiment-large--2026-03-27/ablation-large-bad-structure.html", strip375: true },
  { name: "dt-bad-token", html: "logs/ablation/experiment-large--2026-03-27/ablation-large-bad-token.html", strip375: true },
  { name: "dt-bad-component", html: "logs/ablation/experiment-large--2026-03-27/ablation-large-bad-component.html", strip375: true },
  { name: "dt-bad-naming", html: "logs/ablation/experiment-large--2026-03-27/ablation-large-bad-naming.html", strip375: true },
  { name: "raw-good", html: "logs/ablation/figma-raw-v2--2026-03-27/good.html", strip375: false },
  { name: "raw-bad-structure", html: "logs/ablation/figma-raw-v2--2026-03-27/bad-structure.html", strip375: false },
];

async function main() {
  mkdirSync(join(RUN_DIR, "images"), { recursive: true });
  const results: Record<string, number> = {};

  for (const test of TESTS) {
    console.error(`\n=== ${test.name} @500px ===`);
    
    let htmlPath = resolve(test.html);
    
    // For design-tree HTMLs, remove 375px from root
    if (test.strip375) {
      const content = readFileSync(htmlPath, "utf-8");
      const fixed = content.replace(/width: 375px;?\s*/g, "width: 100%; ");
      const fixedPath = join(RUN_DIR, `${test.name}-500.html`);
      writeFileSync(fixedPath, fixed);
      htmlPath = resolve(fixedPath);
    }
    
    const vcDir = join(RUN_DIR, `vc-${test.name}-500`);
    mkdirSync(vcDir, { recursive: true });
    const codePng = join(vcDir, "code.png");
    
    await renderCodeScreenshot(htmlPath, codePng, { width: 500, height: 4000 }, 1);
    copyFileSync(GROUND_TRUTH, join(vcDir, "figma.png"));
    const result = compareScreenshots(join(vcDir, "figma.png"), codePng, join(vcDir, "diff.png"));
    
    console.error(`  similarity: ${result.similarity}%`);
    results[test.name] = result.similarity;
    
    copyFileSync(codePng, join(RUN_DIR, `images/${test.name}-500-code.png`));
    copyFileSync(join(vcDir, "diff.png"), join(RUN_DIR, `images/${test.name}-500-diff.png`));
  }
  
  // Add already-measured MCP results
  results["mcp-good"] = 92;
  results["mcp-bad-structure"] = 75;

  console.error("\n=== Full @500px comparison ===");
  console.error("| Fixture | design-tree @500 | MCP @500 | figma-raw @500 |");
  console.error("|---|---|---|---|");
  console.error(`| good | ${results["dt-good"]}% | 92% | ${results["raw-good"]}% |`);
  console.error(`| bad-structure | ${results["dt-bad-structure"]}% | 75% | ${results["raw-bad-structure"]}% |`);
  console.error(`| bad-token | ${results["dt-bad-token"]}% | — | — |`);
  console.error(`| bad-component | ${results["dt-bad-component"]}% | — | — |`);
  console.error(`| bad-naming | ${results["dt-bad-naming"]}% | — | — |`);

  writeFileSync(join(RUN_DIR, "results-all-500.json"), JSON.stringify(results, null, 2));
}

main();
