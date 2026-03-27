/**
 * Ablation Phase 1: Priority ranking.
 *
 * For each of 12 information types × 3 fixtures:
 *   1. Generate design-tree (baseline or stripped)
 *   2. Send to Claude API with PROMPT.md
 *   3. Parse HTML + interpretations from response
 *   4. Render HTML → screenshot via Playwright
 *   5. Compare screenshot vs Figma screenshot → similarity
 *   6. Record ΔV, ΔI, ΔT
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx src/agents/ablation/run-phase1.ts
 *
 * Output: logs/ablation/phase1/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
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
const MAX_TOKENS = 16000;

const FIXTURES = [
  "desktop-product-detail",
  "desktop-landing-page",
  "desktop-ai-chat",
] as const;

// Skip no-op strip types (nothing to measure)
const SKIP_TYPES: ReadonlySet<DesignTreeInfoType> = new Set([
  "position-stacking",
  "component-descriptions",
]);

const OUTPUT_DIR = resolve("logs/ablation/phase1");
const PROMPT_PATH = resolve(".claude/skills/design-to-code/PROMPT.md");

// --- Types ---

interface RunResult {
  fixture: string;
  type: "baseline" | DesignTreeInfoType;
  similarity: number;
  interpretationsCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  htmlPath: string;
  codePngPath: string;
  timestamp: string;
}

interface Phase1Summary {
  startedAt: string;
  completedAt: string;
  model: string;
  temperature: number;
  fixtures: string[];
  results: RunResult[];
  rankings: RankingEntry[];
}

interface RankingEntry {
  type: DesignTreeInfoType;
  avgDeltaV: number;
  avgDeltaI: number;
  avgDeltaT: number;
  perFixture: Record<string, { deltaV: number; deltaI: number; deltaT: number }>;
}

// --- Helpers ---

function getRunDir(fixture: string, type: string): string {
  return resolve(OUTPUT_DIR, fixture, type);
}

function isRunComplete(fixture: string, type: string): boolean {
  const dir = getRunDir(fixture, type);
  return existsSync(join(dir, "result.json"));
}

/** Extract HTML code block and interpretations from LLM response. */
function parseResponse(text: string): { html: string; interpretations: string[] } {
  // Extract HTML from ```html ... ``` block
  const htmlMatch = text.match(/```html\s*\n([\s\S]*?)```/);
  const html = htmlMatch?.[1]?.trim() ?? "";

  // Extract interpretations
  const interpMatch = text.match(/\/\/\s*interpretations:\s*([\s\S]*?)(?:```|$)/i);
  if (!interpMatch || interpMatch[1]?.trim().toLowerCase() === "none") {
    return { html, interpretations: [] };
  }

  const interpretations = (interpMatch[1] ?? "")
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);

  return { html, interpretations };
}

/** Get fixture screenshot path (Figma ground truth). */
function getFixtureScreenshotPath(fixture: string): string {
  const width = fixture.startsWith("mobile-") ? 375 : 1200;
  return resolve(`fixtures/${fixture}/screenshot-${width}.png`);
}

/** Get design-tree options for a fixture (vectorDir, imageDir). */
function getDesignTreeOptions(fixture: string) {
  const fixtureDir = resolve(`fixtures/${fixture}`);
  const vectorDir = join(fixtureDir, "vectors");
  const imageDir = join(fixtureDir, "images");
  return {
    ...(existsSync(vectorDir) ? { vectorDir } : {}),
    ...(existsSync(imageDir) ? { imageDir } : {}),
  };
}

// --- Main execution ---

async function runSingle(
  client: Anthropic,
  prompt: string,
  fixture: string,
  type: "baseline" | DesignTreeInfoType,
  designTree: string,
): Promise<RunResult> {
  const runDir = getRunDir(fixture, type);
  mkdirSync(runDir, { recursive: true });

  // Save design-tree for reference
  writeFileSync(join(runDir, "design-tree.txt"), designTree);

  // Call Claude API
  console.log(`    Calling Claude API...`);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: prompt,
    messages: [{ role: "user", content: designTree }],
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  // Save raw response
  writeFileSync(join(runDir, "response.txt"), responseText);

  // Parse HTML and interpretations
  const { html, interpretations } = parseResponse(responseText);
  if (!html) {
    console.warn(`    WARNING: No HTML extracted from response`);
  }

  const htmlPath = join(runDir, "output.html");
  writeFileSync(htmlPath, html);
  writeFileSync(join(runDir, "interpretations.json"), JSON.stringify(interpretations, null, 2));

  // Copy fixture images to run dir so HTML can reference them
  const fixtureImagesDir = resolve(`fixtures/${fixture}/images`);
  if (existsSync(fixtureImagesDir)) {
    const runImagesDir = join(runDir, "images");
    mkdirSync(runImagesDir, { recursive: true });
    const { readdirSync } = await import("node:fs");
    for (const f of readdirSync(fixtureImagesDir)) {
      copyFileSync(join(fixtureImagesDir, f), join(runImagesDir, f));
    }
  }

  // Render HTML to screenshot
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

  // Copy Figma screenshot to run dir
  const figmaCopyPath = join(runDir, "figma.png");
  copyFileSync(figmaScreenshotPath, figmaCopyPath);

  // Compare
  console.log(`    Comparing screenshots...`);
  const diffPath = join(runDir, "diff.png");
  const comparison = compareScreenshots(figmaCopyPath, codePngPath, diffPath);

  const result: RunResult = {
    fixture,
    type,
    similarity: comparison.similarity,
    interpretationsCount: interpretations.length,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    htmlPath,
    codePngPath,
    timestamp: new Date().toISOString(),
  };

  // Save result
  writeFileSync(join(runDir, "result.json"), JSON.stringify(result, null, 2));

  console.log(`    ✓ similarity=${(comparison.similarity * 100).toFixed(1)}% interp=${interpretations.length} tokens=${result.totalTokens}`);

  return result;
}

function computeRankings(results: RunResult[]): RankingEntry[] {
  // Get baselines
  const baselines = new Map<string, RunResult>();
  for (const r of results) {
    if (r.type === "baseline") baselines.set(r.fixture, r);
  }

  // Compute deltas per type × fixture
  const typeResults = new Map<DesignTreeInfoType, Map<string, { deltaV: number; deltaI: number; deltaT: number }>>();

  for (const r of results) {
    if (r.type === "baseline") continue;
    const baseline = baselines.get(r.fixture);
    if (!baseline) continue;

    const type = r.type as DesignTreeInfoType;
    if (!typeResults.has(type)) typeResults.set(type, new Map());

    typeResults.get(type)!.set(r.fixture, {
      deltaV: baseline.similarity - r.similarity,
      deltaI: r.interpretationsCount - baseline.interpretationsCount,
      deltaT: r.totalTokens - baseline.totalTokens,
    });
  }

  // Average across fixtures
  const rankings: RankingEntry[] = [];
  for (const [type, fixtures] of typeResults) {
    const perFixture: Record<string, { deltaV: number; deltaI: number; deltaT: number }> = {};
    let sumDV = 0, sumDI = 0, sumDT = 0;
    let count = 0;
    for (const [fixtureName, deltas] of fixtures) {
      perFixture[fixtureName] = deltas;
      sumDV += deltas.deltaV;
      sumDI += deltas.deltaI;
      sumDT += deltas.deltaT;
      count++;
    }
    rankings.push({
      type,
      avgDeltaV: count > 0 ? sumDV / count : 0,
      avgDeltaI: count > 0 ? sumDI / count : 0,
      avgDeltaT: count > 0 ? sumDT / count : 0,
      perFixture,
    });
  }

  // Sort by avgDeltaV descending (highest impact first)
  rankings.sort((a, b) => b.avgDeltaV - a.avgDeltaV);

  return rankings;
}

function printRankings(rankings: RankingEntry[]): void {
  console.log("\n=== ABLATION PHASE 1 RANKINGS ===\n");
  console.log("  Rank  Type                          avg ΔV      avg ΔI    avg ΔT");
  console.log("  ----  ----------------------------  ----------  --------  --------");
  let rank = 1;
  for (const r of rankings) {
    const dv = (r.avgDeltaV * 100).toFixed(2).padStart(8) + "%";
    const di = (r.avgDeltaI > 0 ? "+" : "") + r.avgDeltaI.toFixed(1);
    const dt = (r.avgDeltaT > 0 ? "+" : "") + r.avgDeltaT.toFixed(0);
    console.log(`  ${String(rank).padStart(4)}  ${r.type.padEnd(28)}  ${dv}  ${di.padStart(8)}  ${dt.padStart(8)}`);
    rank++;
  }
  console.log("");
}

async function main(): Promise<void> {
  // Validate environment
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  if (!existsSync(PROMPT_PATH)) {
    console.error(`Error: PROMPT.md not found at ${PROMPT_PATH}`);
    process.exit(1);
  }

  const prompt = readFileSync(PROMPT_PATH, "utf-8");
  const client = new Anthropic({ apiKey });

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const startedAt = new Date().toISOString();
  const allResults: RunResult[] = [];

  // Load existing results (resume support)
  for (const fixture of FIXTURES) {
    for (const type of ["baseline", ...DESIGN_TREE_INFO_TYPES] as const) {
      if (type !== "baseline" && SKIP_TYPES.has(type as DesignTreeInfoType)) continue;
      if (isRunComplete(fixture, type)) {
        const existing = JSON.parse(readFileSync(join(getRunDir(fixture, type), "result.json"), "utf-8")) as RunResult;
        allResults.push(existing);
        console.log(`  [cached] ${fixture}/${type} → similarity=${(existing.similarity * 100).toFixed(1)}%`);
      }
    }
  }

  // Run missing experiments
  for (const fixture of FIXTURES) {
    console.log(`\n=== ${fixture} ===\n`);

    // Validate fixture exists
    const fixturePath = resolve(`fixtures/${fixture}/data.json`);
    if (!existsSync(fixturePath)) {
      console.error(`  ERROR: Fixture not found: ${fixturePath}`);
      continue;
    }

    const screenshotPath = getFixtureScreenshotPath(fixture);
    if (!existsSync(screenshotPath)) {
      console.error(`  ERROR: Screenshot not found: ${screenshotPath}`);
      continue;
    }

    // Load fixture and generate design-tree
    const file = await loadFigmaFileFromJson(fixturePath);
    const options = getDesignTreeOptions(fixture);
    const baselineTree = generateDesignTree(file, options);

    // Baseline
    if (!isRunComplete(fixture, "baseline")) {
      console.log(`  [baseline]`);
      const result = await runSingle(client, prompt, fixture, "baseline", baselineTree);
      allResults.push(result);
    }

    // Strip each type
    for (const type of DESIGN_TREE_INFO_TYPES) {
      if (SKIP_TYPES.has(type)) continue;
      if (isRunComplete(fixture, type)) continue;

      console.log(`  [${type}]`);
      const strippedTree = stripDesignTree(baselineTree, type);
      const result = await runSingle(client, prompt, fixture, type, strippedTree);
      allResults.push(result);
    }
  }

  // Compute rankings
  const rankings = computeRankings(allResults);
  printRankings(rankings);

  // Save summary
  const summary: Phase1Summary = {
    startedAt,
    completedAt: new Date().toISOString(),
    model: MODEL,
    temperature: TEMPERATURE,
    fixtures: [...FIXTURES],
    results: allResults,
    rankings,
  };

  writeFileSync(join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`Summary saved to ${join(OUTPUT_DIR, "summary.json")}`);

  // Print cost estimate
  const totalInputTokens = allResults.reduce((s, r) => s + r.inputTokens, 0);
  const totalOutputTokens = allResults.reduce((s, r) => s + r.outputTokens, 0);
  const estimatedCost = (totalInputTokens * 3 / 1_000_000) + (totalOutputTokens * 15 / 1_000_000);
  console.log(`\nTotal tokens: ${totalInputTokens} input + ${totalOutputTokens} output`);
  console.log(`Estimated cost: ~$${estimatedCost.toFixed(2)}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
