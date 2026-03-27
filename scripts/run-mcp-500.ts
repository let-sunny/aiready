import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";

const RUN_DIR = "logs/ablation/04-viewport-test";
const GROUND_TRUTH = resolve(RUN_DIR, "images/figma-500px-ground-truth.png");
const MIME: Record<string,string> = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css" };

async function renderMcp(name: string, distDir: string): Promise<number> {
  console.error(`=== ${name} @500px ===`);

  const port = 4400 + Math.floor(Math.random() * 100);
  const srv = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const fp = join(distDir, req.url === "/" ? "index.html" : req.url!);
    try { const d = await readFile(fp); res.writeHead(200, {"Content-Type": MIME[extname(fp)]||"application/octet-stream"}); res.end(d); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise<void>(r => srv.listen(port, r));

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 500, height: 4000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const vcDir = join(RUN_DIR, `vc-${name}`);
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

  // Copy to images for blog
  copyFileSync(codePng, join(RUN_DIR, `images/${name}-code.png`));
  copyFileSync(join(vcDir, "diff.png"), join(RUN_DIR, `images/${name}-diff.png`));

  return result.similarity;
}

async function main() {
  mkdirSync(join(RUN_DIR, "images"), { recursive: true });

  // MCP good @500px — already built at /tmp/mcp-renderer/dist
  const sim = await renderMcp("mcp-vite-good-500", "/tmp/mcp-renderer/dist");

  console.error(`\n  MCP Vite good @375px: 94%`);
  console.error(`  MCP Vite good @500px: ${sim}%`);
  console.error(`  Figma 500px ground truth used for comparison`);
}

main();
