import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";

const RUN_DIR = "logs/ablation/mcp-comparison--2026-03-27";

async function main() {
  const htmlPath = resolve(join(RUN_DIR, "mcp-good-direct.html"));
  const figmaScreenshot = resolve("fixtures/ablation-large-good/screenshot.png");
  const vcDir = join(RUN_DIR, "vc-mcp-direct");
  mkdirSync(vcDir, { recursive: true });

  console.error("=== MCP direct render ===");

  const figmaPng = PNG.sync.read(readFileSync(figmaScreenshot));
  const scale = 2;
  const w = Math.max(1, Math.round(figmaPng.width / scale));
  const h = Math.max(1, Math.round(figmaPng.height / scale));

  // Use full page screenshot instead of element screenshot
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const page = await context.newPage();
  
  // Check for console errors
  page.on("console", msg => {
    if (msg.type() === "error") console.error(`  [browser error] ${msg.text()}`);
  });
  page.on("pageerror", err => console.error(`  [page error] ${err.message}`));

  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000); // Wait for React + Tailwind CDN

  const codePng = join(vcDir, "code.png");
  await page.screenshot({ path: codePng, fullPage: true });
  await browser.close();

  copyFileSync(figmaScreenshot, join(vcDir, "figma.png"));
  const result = compareScreenshots(join(vcDir, "figma.png"), codePng, join(vcDir, "diff.png"));

  console.error(`  similarity: ${result.similarity}%`);
}

main();
