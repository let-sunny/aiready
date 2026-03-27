import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const RUN_DIR = "logs/ablation/mcp-comparison--2026-03-27";
const DIST_DIR = "/tmp/mcp-renderer/dist";

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "application/javascript",
  ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml",
};

async function main() {
  // Start local server for Vite dist
  const server = createServer(async (req, res) => {
    const filePath = join(DIST_DIR, req.url === "/" ? "index.html" : req.url!);
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise<void>(r => server.listen(4173, r));
  console.error("  Server running at http://localhost:4173");

  const figmaScreenshot = resolve("fixtures/ablation-large-good/screenshot.png");
  const vcDir = join(RUN_DIR, "vc-mcp-vite");
  mkdirSync(vcDir, { recursive: true });

  const figmaPng = PNG.sync.read(readFileSync(figmaScreenshot));
  const scale = 2;
  const w = Math.max(1, Math.round(figmaPng.width / scale));
  const h = Math.max(1, Math.round(figmaPng.height / scale));

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const page = await context.newPage();

  page.on("console", msg => { if (msg.type() === "error") console.error(`  [browser] ${msg.text()}`); });
  page.on("pageerror", err => console.error(`  [page error] ${err.message}`));

  await page.goto("http://localhost:4173", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const codePng = join(vcDir, "code.png");
  const root = page.locator("#root > *:first-child");
  if (await root.count() > 0 && await root.isVisible()) {
    await root.screenshot({ path: codePng });
    console.error("  Captured root component");
  } else {
    await page.screenshot({ path: codePng, fullPage: true });
    console.error("  Captured full page");
  }

  await browser.close();
  server.close();

  copyFileSync(figmaScreenshot, join(vcDir, "figma.png"));
  const result = compareScreenshots(join(vcDir, "figma.png"), codePng, join(vcDir, "diff.png"));
  console.error(`  similarity: ${result.similarity}%`);
}

main();
