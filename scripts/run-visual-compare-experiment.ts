import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderCodeScreenshot } from "../src/core/engine/visual-compare.js";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";

const EXPERIMENT_DIR = "logs/ablation/experiment-large--2026-03-27";
const FIXTURES = [
  "ablation-large-good",
  "ablation-large-bad-structure",
  "ablation-large-bad-token",
  "ablation-large-bad-component",
  "ablation-large-bad-naming",
  "ablation-large-bad-behavior",
  "ablation-large-all-bad",
];

async function main() {
  const results: Record<string, number> = {};

  for (const name of FIXTURES) {
    const htmlPath = resolve(EXPERIMENT_DIR, `${name}.html`);
    const figmaScreenshot = resolve(`fixtures/${name}/screenshot.png`);
    const outputDir = join(EXPERIMENT_DIR, `vc-${name}`);
    mkdirSync(outputDir, { recursive: true });

    console.error(`=== ${name} ===`);

    // Get figma screenshot dimensions
    const figmaPng = PNG.sync.read(readFileSync(figmaScreenshot));
    const exportScale = 2;
    const logicalW = Math.max(1, Math.round(figmaPng.width / exportScale));
    const logicalH = Math.max(1, Math.round(figmaPng.height / exportScale));

    // Render code screenshot
    const codePngPath = join(outputDir, "code.png");
    await renderCodeScreenshot(htmlPath, codePngPath, { width: logicalW, height: logicalH }, exportScale);

    // Copy figma screenshot
    const figmaPngPath = join(outputDir, "figma.png");
    copyFileSync(figmaScreenshot, figmaPngPath);

    // Compare
    const diffPath = join(outputDir, "diff.png");
    const result = compareScreenshots(figmaPngPath, codePngPath, diffPath);

    console.error(`  similarity: ${result.similarity}%`);
    results[name] = result.similarity;
  }

  // Summary
  console.error("\n=== Summary ===");
  const good = results["ablation-large-good"] ?? 0;
  for (const [name, sim] of Object.entries(results)) {
    const delta = name === "ablation-large-good" ? "baseline" : `ΔV=${sim - good}`;
    console.error(`  ${name}: ${sim}% (${delta})`);
  }

  // Save results
  const existingResults = JSON.parse(readFileSync(join(EXPERIMENT_DIR, "results.json"), "utf-8"));
  existingResults.visualCompare = results;
  writeFileSync(join(EXPERIMENT_DIR, "results.json"), JSON.stringify(existingResults, null, 2));
  console.error("\nResults saved to results.json");
}

main();
