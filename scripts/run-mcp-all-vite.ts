import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { execSync } from "node:child_process";

const RUN_DIR = "logs/ablation/mcp-vite-all--2026-03-27";
const MCP_RESULTS_DIR = "/Users/minseon/.claude/projects/-Users-minseon-Code-design-readiness-checker/0734b7d3-2c51-4bf7-8987-5f57b082c269/tool-results";
const RENDERER_DIR = "/tmp/mcp-renderer";

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "application/javascript",
  ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml",
};

// Map fixture names to their MCP tool result files
const FIXTURES: Record<string, { toolResult: string; rootComponent: string }> = {
  "good": { toolResult: "toolu_0165iWatHVLaTDvd6f2wp22X.json", rootComponent: "ExamplesProductDetailPage" },
  "bad-structure": { toolResult: "toolu_012ivUDTrt8LL1VTaMrUkjDi.json", rootComponent: "ExamplesProductDetailPage" },
  "bad-token": { toolResult: "toolu_01UvfcnRHzCB3QkB3Tc5jNPT.json", rootComponent: "ExamplesProductDetailPage" },
  "bad-component": { toolResult: "toolu_01AgEgZpsHHnxDc5X6xpRUep.json", rootComponent: "ExamplesProductDetailPage" },
  "bad-naming": { toolResult: "toolu_01K3zymEqhMtFZuMj4pSZeKa.json", rootComponent: "BadNaming" },
  "bad-behavior": { toolResult: "toolu_01WktrAEaSYQfomrjU6sYDxY.json", rootComponent: "ExamplesProductDetailPage" },
};

function extractCode(toolResultPath: string): string {
  const raw = readFileSync(toolResultPath, "utf-8");
  let data: any[];
  try {
    data = JSON.parse(raw);
  } catch {
    // inline text (all-bad)
    return raw;
  }
  
  let code = "";
  for (const block of data) {
    if (block.type === "text") code += block.text;
  }
  
  // Cut at "SUPER CRITICAL"
  const idx = code.indexOf("SUPER CRITICAL");
  if (idx > 0) {
    code = code.substring(0, idx);
    const lastBrace = code.lastIndexOf("}");
    if (lastBrace > 0) code = code.substring(0, lastBrace + 1);
  }
  
  return code.trim();
}

function findRootComponent(code: string): string {
  // Find the last top-level function/export
  const matches = [...code.matchAll(/(?:export default )?function\s+(\w+)/g)];
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    return last?.[1] ?? "App";
  }
  return "App";
}

async function buildAndRender(name: string, code: string, rootComponent: string, figmaScreenshot: string): Promise<number> {
  console.error(`\n=== ${name} ===`);
  
  // Detect root component from code if needed
  const actualRoot = findRootComponent(code);
  console.error(`  Root component: ${actualRoot}`);
  
  // Write App.tsx
  const appCode = `import './index.css'\n\n${code}\n\nexport default function App() {\n  return <${actualRoot} />\n}\n`;
  writeFileSync(join(RENDERER_DIR, "src/App.tsx"), appCode);
  
  // Build
  try {
    execSync("npx vite build", { cwd: RENDERER_DIR, stdio: "pipe", timeout: 30000 });
  } catch (err: any) {
    console.error(`  Build failed: ${err.stderr?.toString().slice(0, 200)}`);
    return -1;
  }
  console.error("  Built successfully");
  
  // Serve and screenshot
  const server = createServer(async (req, res) => {
    const filePath = join(RENDERER_DIR, "dist", req.url === "/" ? "index.html" : req.url!);
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  
  const port = 4173 + Math.floor(Math.random() * 100);
  await new Promise<void>(r => server.listen(port, r));
  
  const figmaPng = PNG.sync.read(readFileSync(figmaScreenshot));
  const scale = 2;
  const w = Math.max(1, Math.round(figmaPng.width / scale));
  const h = Math.max(1, Math.round(figmaPng.height / scale));
  
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const page = await context.newPage();
  
  await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  
  const vcDir = join(RUN_DIR, `vc-${name}`);
  mkdirSync(vcDir, { recursive: true });
  const codePng = join(vcDir, "code.png");
  
  const root = page.locator("#root > *:first-child");
  if (await root.count() > 0 && await root.isVisible()) {
    await root.screenshot({ path: codePng });
  } else {
    await page.screenshot({ path: codePng, fullPage: true });
  }
  
  await browser.close();
  server.close();
  
  copyFileSync(figmaScreenshot, join(vcDir, "figma.png"));
  const result = compareScreenshots(join(vcDir, "figma.png"), codePng, join(vcDir, "diff.png"));
  console.error(`  similarity: ${result.similarity}%`);
  
  return result.similarity;
}

async function main() {
  mkdirSync(RUN_DIR, { recursive: true });
  
  const results: Record<string, number> = {};
  
  for (const [name, info] of Object.entries(FIXTURES)) {
    const toolResultPath = join(MCP_RESULTS_DIR, info.toolResult);
    if (!existsSync(toolResultPath)) {
      console.error(`  Skip ${name}: ${toolResultPath} not found`);
      continue;
    }
    
    const code = extractCode(toolResultPath);
    const figmaScreenshot = resolve(`fixtures/ablation-large-${name}/screenshot.png`);
    
    const similarity = await buildAndRender(name, code, info.rootComponent, figmaScreenshot);
    results[name] = similarity;
  }
  
  // Handle all-bad separately (inline response)
  // all-bad code was returned inline, need to save it first
  
  console.error("\n=== MCP Vite Build Results ===");
  console.error("| Fixture | MCP Vite sim | design-tree sim | figma-raw sim |");
  console.error("|---|---|---|---|");
  
  const dtSims: Record<string, number> = { good: 94, "bad-structure": 84, "bad-token": 90, "bad-component": 91, "bad-naming": 94, "bad-behavior": 94, "all-bad": 84 };
  const rawSims: Record<string, number> = { good: 78, "bad-structure": 3, "bad-token": 69, "bad-component": 66, "bad-naming": 78, "bad-behavior": 80, "all-bad": 73 };
  
  for (const [name, sim] of Object.entries(results)) {
    console.error(`| ${name} | ${sim}% | ${dtSims[name]}% | ${rawSims[name]}% |`);
  }
  
  writeFileSync(join(RUN_DIR, "results.json"), JSON.stringify(results, null, 2));
}

main();
