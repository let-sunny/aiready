import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

const RUN_DIR = "logs/ablation/04-viewport-test";
const GROUND_TRUTH = resolve(RUN_DIR, "images/figma-500px-ground-truth.png");
const MIME: Record<string,string> = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css" };

async function main() {
  console.error("=== MCP Vite good (375px removed) @500px ===");
  const port = 4470;
  const srv = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const fp = join("/tmp/mcp-renderer/dist", req.url === "/" ? "index.html" : req.url!);
    try { const d = await readFile(fp); res.writeHead(200, {"Content-Type": MIME[extname(fp)]||"application/octet-stream"}); res.end(d); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise<void>(r => srv.listen(port, r));

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 500, height: 4000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const vcDir = join(RUN_DIR, "vc-mcp-good-no375-500");
  mkdirSync(vcDir, { recursive: true });
  const codePng = join(vcDir, "code.png");
  const root = page.locator("#root > *:first-child");
  if (await root.count() > 0 && await root.isVisible()) await root.screenshot({ path: codePng });
  else await page.screenshot({ path: codePng, fullPage: true });
  await browser.close();
  srv.close();

  const gt = PNG.sync.read(readFileSync(GROUND_TRUTH));
  const code = PNG.sync.read(readFileSync(codePng));
  console.error(`  Ground truth: ${gt.width}x${gt.height}`);
  console.error(`  Code render:  ${code.width}x${code.height}`);

  copyFileSync(GROUND_TRUTH, join(vcDir, "figma.png"));
  const result = compareScreenshots(join(vcDir, "figma.png"), codePng, join(vcDir, "diff.png"));
  console.error(`  similarity: ${result.similarity}%`);

  copyFileSync(codePng, join(RUN_DIR, "images/mcp-good-no375-500-code.png"));
  copyFileSync(join(vcDir, "diff.png"), join(RUN_DIR, "images/mcp-good-no375-500-diff.png"));

  console.error("\n=== @500px comparison ===");
  console.error(`  design-tree (375 제거): 95%`);
  console.error(`  MCP Vite (375 제거):    ${result.similarity}%`);
  console.error(`  MCP Vite (원본):        92%`);
}

main();
