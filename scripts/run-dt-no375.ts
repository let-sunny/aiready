import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderCodeScreenshot } from "../src/core/engine/visual-compare.js";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";

const RUN_DIR = "logs/ablation/04-viewport-test";
const GROUND_TRUTH = resolve(RUN_DIR, "images/figma-500px-ground-truth.png");

async function main() {
  const htmlPath = resolve(RUN_DIR, "design-tree-good-no375.html");
  const vcDir = join(RUN_DIR, "vc-dt-good-no375-500");
  mkdirSync(vcDir, { recursive: true });

  console.error("=== design-tree good (375px removed) @500px ===");

  const codePng = join(vcDir, "code.png");
  await renderCodeScreenshot(htmlPath, codePng, { width: 500, height: 4000 }, 1);

  const gt = PNG.sync.read(readFileSync(GROUND_TRUTH));
  const code = PNG.sync.read(readFileSync(codePng));
  console.error(`  Ground truth: ${gt.width}x${gt.height}`);
  console.error(`  Code render:  ${code.width}x${code.height}`);

  copyFileSync(GROUND_TRUTH, join(vcDir, "figma.png"));
  const result = compareScreenshots(join(vcDir, "figma.png"), codePng, join(vcDir, "diff.png"));
  console.error(`  similarity: ${result.similarity}%`);

  copyFileSync(codePng, join(RUN_DIR, "images/dt-good-no375-500-code.png"));
  copyFileSync(join(vcDir, "diff.png"), join(RUN_DIR, "images/dt-good-no375-500-diff.png"));

  console.error(`\n=== @500px Comparison ===`);
  console.error(`  MCP good:                92%`);
  console.error(`  MCP bad-structure:       75%`);
  console.error(`  design-tree (375px fix): ${result.similarity}%`);
}

main();
