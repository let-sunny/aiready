import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { renderCodeScreenshot } from "../src/core/engine/visual-compare.js";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";

const RUN_DIR = "logs/ablation/04-viewport-test";
const GROUND_TRUTH = resolve(RUN_DIR, "images/figma-500px-ground-truth.png");
const VIEWPORT_W = 500;

// HTML files to test at 500px
const TESTS: Record<string, { htmlPath: string; method: string }> = {
  "design-tree-good": {
    htmlPath: "logs/ablation/experiment-large--2026-03-27/ablation-large-good.html",
    method: "design-tree → AI",
  },
  "design-tree-bad-structure": {
    htmlPath: "logs/ablation/experiment-large--2026-03-27/ablation-large-bad-structure.html",
    method: "design-tree → AI (bad-structure)",
  },
  "figma-raw-good": {
    htmlPath: "logs/ablation/figma-raw-v2--2026-03-27/good.html",
    method: "figma-raw → AI",
  },
  "figma-raw-bad-structure": {
    htmlPath: "logs/ablation/figma-raw-v2--2026-03-27/bad-structure.html",
    method: "figma-raw → AI (bad-structure)",
  },
};

async function renderAt500(name: string, htmlPath: string): Promise<number> {
  console.error(`\n=== ${name} ===`);

  const gtPng = PNG.sync.read(readFileSync(GROUND_TRUTH));
  // Ground truth is from Figma at 500px. Use its height.
  const scale = 2;
  const h = Math.max(1, Math.round(gtPng.height / scale));

  const vcDir = join(RUN_DIR, `vc-${name}`);
  mkdirSync(vcDir, { recursive: true });

  const codePng = join(vcDir, "code.png");
  await renderCodeScreenshot(resolve(htmlPath), codePng, { width: VIEWPORT_W, height: h }, scale);

  copyFileSync(GROUND_TRUTH, join(vcDir, "figma.png"));
  const result = compareScreenshots(join(vcDir, "figma.png"), codePng, join(vcDir, "diff.png"));

  console.error(`  similarity: ${result.similarity}%`);
  return result.similarity;
}

async function renderMcpAt500(): Promise<number> {
  console.error(`\n=== mcp-vite-good @500px ===`);

  const MIME: Record<string,string> = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css" };
  const DIST = "/tmp/mcp-renderer/dist";
  const port = 4300 + Math.floor(Math.random() * 100);

  const srv = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const fp = join(DIST, req.url === "/" ? "index.html" : req.url!);
    try { const d = await readFile(fp); res.writeHead(200, {"Content-Type": MIME[extname(fp)]||"application/octet-stream"}); res.end(d); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise<void>(r => srv.listen(port, r));

  const gtPng = PNG.sync.read(readFileSync(GROUND_TRUTH));
  const scale = 2;
  const h = Math.max(1, Math.round(gtPng.height / scale));

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: VIEWPORT_W, height: h }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const vcDir = join(RUN_DIR, "vc-mcp-vite-good");
  mkdirSync(vcDir, { recursive: true });
  const codePng = join(vcDir, "code.png");

  const root = page.locator("#root > *:first-child");
  if (await root.count() > 0 && await root.isVisible()) await root.screenshot({ path: codePng });
  else await page.screenshot({ path: codePng, fullPage: true });

  await browser.close();
  srv.close();

  copyFileSync(GROUND_TRUTH, join(vcDir, "figma.png"));
  const result = compareScreenshots(join(vcDir, "figma.png"), codePng, join(vcDir, "diff.png"));
  console.error(`  similarity: ${result.similarity}%`);
  return result.similarity;
}

async function main() {
  mkdirSync(RUN_DIR, { recursive: true });
  const results: Record<string, number> = {};

  for (const [name, info] of Object.entries(TESTS)) {
    results[name] = await renderAt500(name, info.htmlPath);
  }

  results["mcp-vite-good"] = await renderMcpAt500();

  console.error("\n=== 500px Viewport Test ===");
  console.error("| Method | @375px | @500px |");
  console.error("|---|---|---|");
  console.error(`| design-tree good | 94% | ${results["design-tree-good"]}% |`);
  console.error(`| design-tree bad-structure | 84% | ${results["design-tree-bad-structure"]}% |`);
  console.error(`| figma-raw good | 79% | ${results["figma-raw-good"]}% |`);
  console.error(`| figma-raw bad-structure | 55% | ${results["figma-raw-bad-structure"]}% |`);
  console.error(`| MCP Vite good | 94% | ${results["mcp-vite-good"]}% |`);

  writeFileSync(join(RUN_DIR, "results.json"), JSON.stringify(results, null, 2));
}

main();
