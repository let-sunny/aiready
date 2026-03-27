/**
 * Ablation Phase 1: Priority ranking via strip experiments.
 *
 * For each of 6 strip types × N fixtures × M runs:
 *   1. Generate design-tree (baseline or stripped)
 *   2. Send to Claude API with PROMPT.md
 *   3. Parse HTML from response
 *   4. Render HTML → screenshot via Playwright
 *   5. Compare screenshot vs Figma screenshot → similarity
 *   6. Record pixel similarity, tokens, HTML size, CSS class/variable counts
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx src/agents/ablation/run-phase1.ts
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY  — required
 *   ABLATION_FIXTURES  — comma-separated fixture names (default: 3 desktop fixtures)
 *   ABLATION_TYPES     — comma-separated strip types to run (default: all 6)
 *   ABLATION_RUNS      — runs per condition (default: 1, set 3 for Phase 2)
 *
 * Output: logs/ablation/phase1/{config-version}/{fixture}/{type}/run-{n}/
 *
 * Cache: results are preserved per config-version. Changing core source files
 * (design-tree, strip, visual-compare) creates a new version directory.
 * Previous versions are never deleted.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

import { generateDesignTree } from "../../core/engine/design-tree.js";
import { stripDesignTree, DESIGN_TREE_INFO_TYPES } from "../../core/engine/design-tree-strip.js";
import type { DesignTreeInfoType } from "../../core/engine/design-tree-strip.js";
import { loadFigmaFileFromJson } from "../../core/adapters/figma-file-loader.js";
import { renderCodeScreenshot } from "../../core/engine/visual-compare.js";
import { compareScreenshots } from "../../core/engine/visual-compare-helpers.js";

// --- Configuration ---

const MODEL = "claude-sonnet-4-20250514";
const TEMPERATURE = 0;
const MAX_TOKENS = 32000;

const DEFAULT_FIXTURES = [
  "desktop-product-detail",
  "desktop-landing-page",
  "desktop-ai-chat",
];

const BASE_OUTPUT_DIR = resolve("logs/ablation/phase1");
const PROMPT_PATH = resolve(".claude/skills/design-to-code/PROMPT.md");

// --- Config version (auto-computed, excludes this file) ---

function computeConfigVersion(): string {
  const coreFiles = [
    resolve("src/core/engine/design-tree-strip.ts"),
    resolve("src/core/engine/design-tree.ts"),
    resolve("src/core/engine/visual-compare.ts"),
    resolve("src/core/engine/visual-compare-helpers.ts"),
    resolve("src/core/adapters/figma-file-loader.ts"),
    // Note: run-phase1.ts intentionally excluded — parsing/output logic
    // changes don't affect similarity results. Only strip/render/compare matters.
  ];
  const hash = createHash("sha256");
  for (const f of coreFiles) {
    if (existsSync(f)) hash.update(readFileSync(f, "utf-8"));
  }
  return hash.digest("hex").slice(0, 12);
}

const CONFIG_VERSION = computeConfigVersion();

// --- Types ---

interface RunResult {
  fixture: string;
  type: "baseline" | DesignTreeInfoType;
  runIndex: number;
  similarity: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  htmlBytes: number;
  htmlLines: number;
  cssClassCount: number;
  cssVariableCount: number;
  timestamp: string;
  context: {
    configVersion: string;
    model: string;
    temperature: number;
    maxTokens: number;
    promptHash: string;
    fixtureHash: string;
    screenshotPath: string;
    logicalViewport: { width: number; height: number };
    exportScale: number;
    htmlExtractMethod: string;
    designTreeChars: number;
  };
}

interface Phase1Summary {
  startedAt: string;
  completedAt: string;
  configVersion: string;
  model: string;
  temperature: number;
  runsPerCondition: number;
  fixtures: string[];
  skippedFixtures: Array<{ fixture: string; reason: string }>;
  cacheStats: { hits: number; newCalls: number };
  results: RunResult[];
  rankings: RankingEntry[];
}

interface RankingEntry {
  type: DesignTreeInfoType;
  avgDeltaV: number;
  avgDeltaOutputTokens: number;
  avgDeltaHtmlBytes: number;
  avgDeltaCssClasses: number;
  avgDeltaCssVariables: number;
  perFixture: Record<string, {
    deltaV: number;
    deltaOutputTokens: number;
    deltaHtmlBytes: number;
    deltaCssClasses: number;
    deltaCssVariables: number;
  }>;
}

// --- Helpers ---

function computePromptHash(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

function computeFixtureHash(fixture: string): string {
  const hash = createHash("sha256");
  const dataPath = resolve(`fixtures/${fixture}/data.json`);
  if (existsSync(dataPath)) hash.update(readFileSync(dataPath));
  const ssPath = getFixtureScreenshotPath(fixture);
  if (existsSync(ssPath)) hash.update(readFileSync(ssPath));
  return hash.digest("hex").slice(0, 12);
}

function getOutputDir(): string {
  return join(BASE_OUTPUT_DIR, CONFIG_VERSION);
}

function getRunDir(fixture: string, type: string, runIndex: number): string {
  return join(getOutputDir(), fixture, type, `run-${runIndex}`);
}

function getResultPath(fixture: string, type: string, runIndex: number): string {
  return join(getRunDir(fixture, type, runIndex), "result.json");
}

const REQUIRED_ARTIFACTS = ["result.json", "output.html", "code.png", "figma.png", "diff.png"];

function isCacheValid(fixture: string, type: string, runIndex: number): boolean {
  const runDir = getRunDir(fixture, type, runIndex);
  for (const artifact of REQUIRED_ARTIFACTS) {
    if (!existsSync(join(runDir, artifact))) return false;
  }
  try {
    const parsed = JSON.parse(readFileSync(join(runDir, "result.json"), "utf-8")) as unknown;
    if (!parsed || typeof parsed !== "object") return false;
    const r = parsed as Record<string, unknown>;
    return (
      typeof r["similarity"] === "number" && Number.isFinite(r["similarity"]) &&
      typeof r["inputTokens"] === "number" && Number.isFinite(r["inputTokens"])
    );
  } catch {
    return false;
  }
}

function isStripNoOp(baselineTree: string, type: DesignTreeInfoType): boolean {
  return stripDesignTree(baselineTree, type) === baselineTree;
}

function getFixtureScreenshotPath(fixture: string): string {
  const width = fixture.startsWith("mobile-") ? 375 : 1200;
  return resolve(`fixtures/${fixture}/screenshot-${width}.png`);
}

function getDesignTreeOptions(fixture: string) {
  const fixtureDir = resolve(`fixtures/${fixture}`);
  const vectorDir = join(fixtureDir, "vectors");
  const imageDir = join(fixtureDir, "images");
  return {
    ...(existsSync(vectorDir) ? { vectorDir } : {}),
    ...(existsSync(imageDir) ? { imageDir } : {}),
  };
}

// --- HTML parsing ---

function extractHtml(text: string): { html: string; method: string } {
  // Match both closed and unclosed code blocks (truncated by max_tokens)
  const allBlocks = [...text.matchAll(/```(?:html|css|[a-z]*)?\s*\n([\s\S]*?)(?:```|$)/g)]
    .map((m) => m[1]?.trim() ?? "")
    .filter((block) => block.includes("<") && block.length > 50);

  if (allBlocks.length === 0) return { html: "", method: "none" };

  const fullDoc = allBlocks.find((b) => /^<!doctype|^<html/i.test(b));
  if (fullDoc) return { html: fullDoc, method: "doctype" };

  const hasBody = allBlocks.find((b) => /<body/i.test(b));
  if (hasBody) return { html: hasBody, method: "body" };

  return { html: allBlocks.reduce((a, b) => (a.length >= b.length ? a : b)), method: "largest" };
}

function sanitizeHtml(html: string): string {
  let result = html;
  result = result.replace(/^\/\/\s*filename:.*\n/i, "");
  result = result.replace(/<script[\s\S]*?<\/script>/gi, "");
  result = result.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "");
  result = result.replace(/\s+on\w+\s*=\s*'[^']*'/gi, "");
  result = result.replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"');
  result = result.replace(/href\s*=\s*'javascript:[^']*'/gi, "href='#'");
  return result;
}

function injectLocalFont(html: string): string {
  const fontPath = resolve("assets/fonts/Inter.var.woff2");
  if (!existsSync(fontPath)) return html;
  const fontCss = `@font-face { font-family: "Inter"; src: url("file://${fontPath}") format("woff2"); font-weight: 100 900; }`;
  let result = html;
  result = result.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, "");
  result = result.replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/gi, "");
  if (result.includes("<style>")) {
    result = result.replace("<style>", `<style>\n${fontCss}\n`);
  } else if (result.includes("</head>")) {
    result = result.replace("</head>", `<style>${fontCss}</style>\n</head>`);
  }
  return result;
}

// --- CSS metrics ---

function countCssClasses(html: string): number {
  const classMatch = html.match(/<style[\s\S]*?<\/style>/i);
  if (!classMatch) return 0;
  const style = classMatch[0];
  const classes = style.match(/\.[a-zA-Z][\w-]*\s*[{,:]/g);
  return new Set(classes?.map((c) => c.replace(/\s*[{,:]$/, ""))).size;
}

function countCssVariables(html: string): number {
  const classMatch = html.match(/<style[\s\S]*?<\/style>/i);
  if (!classMatch) return 0;
  const style = classMatch[0];
  const vars = style.match(/--[\w-]+\s*:/g);
  return new Set(vars?.map((v) => v.replace(/\s*:$/, ""))).size;
}

// --- API call ---

async function callApi(
  client: Anthropic,
  prompt: string,
  designTree: string,
): Promise<Anthropic.Message> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: prompt,
        messages: [{ role: "user", content: designTree }],
      });
      return await stream.finalMessage();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if ((status === 429 || status === 529) && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.warn(`    ⚠ ${status} error, retrying in ${delay / 1000}s (${attempt + 1}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("API call failed after retries");
}

// --- Single run ---

async function runSingle(
  client: Anthropic,
  prompt: string,
  promptHash: string,
  fixture: string,
  fixtureHash: string,
  type: "baseline" | DesignTreeInfoType,
  designTree: string,
  runIndex: number,
): Promise<RunResult> {
  const runDir = getRunDir(fixture, type, runIndex);
  mkdirSync(runDir, { recursive: true });

  writeFileSync(join(runDir, "design-tree.txt"), designTree);

  // API call
  console.log(`    Calling Claude API (run ${runIndex + 1})...`);
  const response = await callApi(client, prompt, designTree);

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  writeFileSync(join(runDir, "response.txt"), responseText);

  // Parse + sanitize HTML
  const { html, method } = extractHtml(responseText);
  if (!html) console.warn("    WARNING: No HTML code block found in response");

  let finalHtml = sanitizeHtml(html);
  finalHtml = injectLocalFont(finalHtml);

  const htmlPath = join(runDir, "output.html");
  writeFileSync(htmlPath, finalHtml);

  // CSS metrics
  const cssClassCount = countCssClasses(finalHtml);
  const cssVariableCount = countCssVariables(finalHtml);

  // Copy fixture images
  const fixtureImagesDir = resolve(`fixtures/${fixture}/images`);
  if (existsSync(fixtureImagesDir)) {
    const runImagesDir = join(runDir, "images");
    mkdirSync(runImagesDir, { recursive: true });
    for (const f of readdirSync(fixtureImagesDir)) {
      copyFileSync(join(fixtureImagesDir, f), join(runImagesDir, f));
    }
  }

  // Render screenshot
  console.log(`    Rendering screenshot...`);
  const codePngPath = join(runDir, "code.png");
  const figmaScreenshotPath = getFixtureScreenshotPath(fixture);
  const figmaPng = readFileSync(figmaScreenshotPath);
  const { PNG } = await import("pngjs");
  const figmaImage = PNG.sync.read(figmaPng);
  const exportScale = 2;
  const logicalW = Math.max(1, Math.round(figmaImage.width / exportScale));
  const logicalH = Math.max(1, Math.round(figmaImage.height / exportScale));

  await renderCodeScreenshot(htmlPath, codePngPath, { width: logicalW, height: logicalH }, exportScale);

  // Copy figma screenshot
  const figmaCopyPath = join(runDir, "figma.png");
  copyFileSync(figmaScreenshotPath, figmaCopyPath);

  // Crop to matching dimensions
  const codeImage = PNG.sync.read(readFileSync(codePngPath));
  const figmaCopy = PNG.sync.read(readFileSync(figmaCopyPath));
  const cropW = Math.min(codeImage.width, figmaCopy.width);
  const cropH = Math.min(codeImage.height, figmaCopy.height);

  if (codeImage.width !== cropW || codeImage.height !== cropH) {
    const cropped = new PNG({ width: cropW, height: cropH });
    for (let y = 0; y < cropH; y++) {
      codeImage.data.copy(cropped.data, y * cropW * 4, y * codeImage.width * 4, y * codeImage.width * 4 + cropW * 4);
    }
    writeFileSync(codePngPath, PNG.sync.write(cropped));
    console.log(`    Cropped code.png: ${codeImage.width}x${codeImage.height} → ${cropW}x${cropH}`);
  }
  if (figmaCopy.width !== cropW || figmaCopy.height !== cropH) {
    const cropped = new PNG({ width: cropW, height: cropH });
    for (let y = 0; y < cropH; y++) {
      figmaCopy.data.copy(cropped.data, y * cropW * 4, y * figmaCopy.width * 4, y * figmaCopy.width * 4 + cropW * 4);
    }
    writeFileSync(figmaCopyPath, PNG.sync.write(cropped));
    console.log(`    Cropped figma.png: ${figmaCopy.width}x${figmaCopy.height} → ${cropW}x${cropH}`);
  }

  // Compare
  console.log(`    Comparing screenshots...`);
  const diffPath = join(runDir, "diff.png");
  const comparison = compareScreenshots(figmaCopyPath, codePngPath, diffPath);

  const htmlBytes = Buffer.byteLength(finalHtml, "utf-8");
  const htmlLines = finalHtml.split("\n").length;

  const result: RunResult = {
    fixture,
    type,
    runIndex,
    similarity: comparison.similarity,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    htmlBytes,
    htmlLines,
    cssClassCount,
    cssVariableCount,
    timestamp: new Date().toISOString(),
    context: {
      configVersion: CONFIG_VERSION,
      model: MODEL,
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
      promptHash,
      fixtureHash,
      screenshotPath: figmaScreenshotPath,
      logicalViewport: { width: logicalW, height: logicalH },
      exportScale,
      htmlExtractMethod: method,
      designTreeChars: designTree.length,
    },
  };

  writeFileSync(join(runDir, "result.json"), JSON.stringify(result, null, 2));

  console.log(`    ✓ sim=${comparison.similarity.toFixed(1)}% out=${response.usage.output_tokens} html=${htmlBytes}B cls=${cssClassCount} vars=${cssVariableCount}`);

  return result;
}

// --- Rankings ---

function computeRankings(results: RunResult[]): RankingEntry[] {
  const baselineIndex = new Map<string, RunResult>();
  for (const r of results) {
    if (r.type === "baseline") baselineIndex.set(`${r.fixture}:${r.runIndex}`, r);
  }

  const pairedDeltas = new Map<DesignTreeInfoType, Map<string, {
    deltaV: number[]; deltaOutTok: number[]; deltaHtml: number[];
    deltaCls: number[]; deltaVars: number[];
  }>>();

  for (const r of results) {
    if (r.type === "baseline") continue;
    const type = r.type as DesignTreeInfoType;
    const baseline = baselineIndex.get(`${r.fixture}:${r.runIndex}`);
    if (!baseline) continue;

    if (!pairedDeltas.has(type)) pairedDeltas.set(type, new Map());
    const fd = pairedDeltas.get(type)!;
    if (!fd.has(r.fixture)) fd.set(r.fixture, { deltaV: [], deltaOutTok: [], deltaHtml: [], deltaCls: [], deltaVars: [] });
    const d = fd.get(r.fixture)!;

    d.deltaV.push(baseline.similarity - r.similarity);
    d.deltaOutTok.push(r.outputTokens - baseline.outputTokens);
    d.deltaHtml.push(r.htmlBytes - baseline.htmlBytes);
    d.deltaCls.push(r.cssClassCount - baseline.cssClassCount);
    d.deltaVars.push(r.cssVariableCount - baseline.cssVariableCount);
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const rankings: RankingEntry[] = [];
  for (const [type, fixtures] of pairedDeltas) {
    const perFixture: Record<string, { deltaV: number; deltaOutputTokens: number; deltaHtmlBytes: number; deltaCssClasses: number; deltaCssVariables: number }> = {};
    let sumDV = 0, sumDOT = 0, sumDH = 0, sumDC = 0, sumDVa = 0;
    let count = 0;
    for (const [fn, d] of fixtures) {
      const dv = avg(d.deltaV);
      const dot = avg(d.deltaOutTok);
      const dh = avg(d.deltaHtml);
      const dc = avg(d.deltaCls);
      const dva = avg(d.deltaVars);
      perFixture[fn] = { deltaV: dv, deltaOutputTokens: dot, deltaHtmlBytes: dh, deltaCssClasses: dc, deltaCssVariables: dva };
      sumDV += dv; sumDOT += dot; sumDH += dh; sumDC += dc; sumDVa += dva;
      count++;
    }
    rankings.push({
      type,
      avgDeltaV: count > 0 ? sumDV / count : 0,
      avgDeltaOutputTokens: count > 0 ? sumDOT / count : 0,
      avgDeltaHtmlBytes: count > 0 ? sumDH / count : 0,
      avgDeltaCssClasses: count > 0 ? sumDC / count : 0,
      avgDeltaCssVariables: count > 0 ? sumDVa / count : 0,
      perFixture,
    });
  }

  rankings.sort((a, b) =>
    b.avgDeltaV - a.avgDeltaV
    || b.avgDeltaOutputTokens - a.avgDeltaOutputTokens
    || b.avgDeltaHtmlBytes - a.avgDeltaHtmlBytes
  );
  return rankings;
}

function printRankings(rankings: RankingEntry[]): void {
  console.log("\n=== ABLATION RANKINGS ===\n");
  console.log("  Rank  Type                          ΔV%     ΔOutTok  ΔHTML(B)  ΔClass  ΔVars");
  console.log("  ----  ----------------------------  ------  -------  --------  ------  -----");
  let rank = 1;
  for (const r of rankings) {
    const dv = r.avgDeltaV.toFixed(1).padStart(6) + "%";
    const dot = (r.avgDeltaOutputTokens > 0 ? "+" : "") + r.avgDeltaOutputTokens.toFixed(0);
    const dh = (r.avgDeltaHtmlBytes > 0 ? "+" : "") + r.avgDeltaHtmlBytes.toFixed(0);
    const dc = (r.avgDeltaCssClasses > 0 ? "+" : "") + r.avgDeltaCssClasses.toFixed(0);
    const dva = (r.avgDeltaCssVariables > 0 ? "+" : "") + r.avgDeltaCssVariables.toFixed(0);
    console.log(`  ${String(rank).padStart(4)}  ${r.type.padEnd(28)}  ${dv}  ${dot.padStart(7)}  ${dh.padStart(8)}  ${dc.padStart(6)}  ${dva.padStart(5)}`);
    rank++;
  }
  console.log("");
}

// --- Main ---

async function main(): Promise<void> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  if (!existsSync(PROMPT_PATH)) {
    console.error(`Error: PROMPT.md not found at ${PROMPT_PATH}`);
    process.exit(1);
  }

  const fixtures = process.env["ABLATION_FIXTURES"]
    ? process.env["ABLATION_FIXTURES"].split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_FIXTURES;
  if (fixtures.length === 0) {
    console.error("Error: No fixtures specified.");
    process.exit(1);
  }
  const SAFE_NAME = /^[a-z0-9][a-z0-9_-]*$/;
  for (const f of fixtures) {
    if (!SAFE_NAME.test(f)) {
      console.error(`Error: Invalid fixture name "${f}".`);
      process.exit(1);
    }
  }

  const rawRuns = process.env["ABLATION_RUNS"];
  let runsPerCondition = 1;
  if (rawRuns) {
    if (!/^\d+$/.test(rawRuns) || Number(rawRuns) < 1) {
      console.error(`Error: ABLATION_RUNS must be a positive integer (got: "${rawRuns}")`);
      process.exit(1);
    }
    runsPerCondition = Number(rawRuns);
  }

  // Filter to requested types
  const requestedTypes: DesignTreeInfoType[] | null = process.env["ABLATION_TYPES"]
    ? process.env["ABLATION_TYPES"].split(",").map((s) => s.trim()).filter(Boolean) as DesignTreeInfoType[]
    : null;

  const prompt = readFileSync(PROMPT_PATH, "utf-8");
  const promptHash = computePromptHash(prompt);
  const client = new Anthropic({ apiKey });

  const outputDir = getOutputDir();
  mkdirSync(outputDir, { recursive: true });

  console.log(`Config version: ${CONFIG_VERSION}`);
  console.log(`Output dir: ${outputDir}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Fixtures: ${fixtures.join(", ")}`);
  console.log(`Types: ${requestedTypes ? requestedTypes.join(", ") : "all"}`);
  console.log(`Runs per condition: ${runsPerCondition}`);
  console.log("");

  const startedAt = new Date().toISOString();
  const allResults: RunResult[] = [];
  const newResults: RunResult[] = [];
  const skippedFixtures: Array<{ fixture: string; reason: string }> = [];
  let cacheHits = 0;

  for (const fixture of fixtures) {
    console.log(`\n=== ${fixture} ===\n`);

    const fixturePath = resolve(`fixtures/${fixture}/data.json`);
    if (!existsSync(fixturePath)) {
      console.error(`  ERROR: Fixture not found: ${fixturePath}`);
      skippedFixtures.push({ fixture, reason: `data.json not found` });
      continue;
    }

    const screenshotPath = getFixtureScreenshotPath(fixture);
    if (!existsSync(screenshotPath)) {
      console.error(`  ERROR: Screenshot not found: ${screenshotPath}`);
      skippedFixtures.push({ fixture, reason: `screenshot not found` });
      continue;
    }

    const fixtureHash = computeFixtureHash(fixture);
    const file = await loadFigmaFileFromJson(fixturePath);
    const options = getDesignTreeOptions(fixture);
    const baselineTree = generateDesignTree(file, options);

    // Determine types to run
    const skipTypes = new Set<DesignTreeInfoType>();
    const typesToRun = requestedTypes ?? [...DESIGN_TREE_INFO_TYPES];
    for (const type of typesToRun) {
      if (isStripNoOp(baselineTree, type)) skipTypes.add(type);
    }
    if (skipTypes.size > 0) {
      console.log(`  Skipping no-op types: ${[...skipTypes].join(", ")}`);
    }

    const conditions: Array<"baseline" | DesignTreeInfoType> = [
      "baseline",
      ...typesToRun.filter((t) => !skipTypes.has(t)),
    ];

    for (const type of conditions) {
      for (let run = 0; run < runsPerCondition; run++) {
        try {
          if (isCacheValid(fixture, type, run)) {
            const cached = JSON.parse(readFileSync(getResultPath(fixture, type, run), "utf-8")) as RunResult;
            allResults.push(cached);
            cacheHits++;
            console.log(`  [cached] ${type} run ${run + 1} → sim=${cached.similarity.toFixed(1)}% cls=${cached.cssClassCount} vars=${cached.cssVariableCount}`);
            continue;
          }

          console.log(`  [${type}] run ${run + 1}/${runsPerCondition}`);
          const tree = type === "baseline" ? baselineTree : stripDesignTree(baselineTree, type);
          const result = await runSingle(client, prompt, promptHash, fixture, fixtureHash, type, tree, run);
          allResults.push(result);
          newResults.push(result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  ERROR [${fixture}/${type}/run-${run}]: ${msg}`);
          skippedFixtures.push({ fixture, reason: `${type}/run-${run}: ${msg}` });
        }
      }
    }
  }

  // Rankings
  const rankings = computeRankings(allResults);
  printRankings(rankings);

  // Summary
  const summary: Phase1Summary = {
    startedAt,
    completedAt: new Date().toISOString(),
    configVersion: CONFIG_VERSION,
    model: MODEL,
    temperature: TEMPERATURE,
    runsPerCondition,
    fixtures: [...fixtures],
    skippedFixtures,
    cacheStats: { hits: cacheHits, newCalls: newResults.length },
    results: allResults,
    rankings,
  };

  writeFileSync(join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`Summary saved to ${join(outputDir, "summary.json")}`);

  // Cost
  const sessionInputTokens = newResults.reduce((s, r) => s + r.inputTokens, 0);
  const sessionOutputTokens = newResults.reduce((s, r) => s + r.outputTokens, 0);
  const sessionCost = (sessionInputTokens * 3 / 1_000_000) + (sessionOutputTokens * 15 / 1_000_000);
  console.log(`\nThis session: ${newResults.length} new calls, ${cacheHits} cached`);
  console.log(`Session tokens: ${sessionInputTokens} input + ${sessionOutputTokens} output`);
  console.log(`Session cost: ~$${sessionCost.toFixed(2)}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
