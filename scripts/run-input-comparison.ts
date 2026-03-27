import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderCodeScreenshot } from "../src/core/engine/visual-compare.js";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 64000;
const BUDGET_TOKENS = 10000;
const RUN_DIR = "logs/ablation/input-comparison--2026-03-27";
const FIXTURE = "fixtures/ablation-large-good";

const PROMPTS: Record<string, (input: string) => string> = {
  "design-tree": (input) => `You are a frontend developer. Convert the following design tree into a single, self-contained HTML file.

Requirements:
- Output ONLY the HTML code, nothing else. No markdown fences, no explanations.
- Use inline CSS styles (no external stylesheets).
- Match every dimension, color, font, spacing, and layout property exactly as specified.
- Each node in the design tree maps to one HTML element.
- Use semantic HTML where appropriate (div, section, h1-h6, p, span, etc.).
- For images ([IMAGE] or url(...)), use a colored placeholder div with the same dimensions.
- Include a reset style: * { margin: 0; padding: 0; box-sizing: border-box; }

Design Tree:
${input}`,

  "figma-raw": (input) => `You are a frontend developer. Convert the following Figma REST API JSON into a single, self-contained HTML file.

The JSON is a Figma document node tree. Key properties:
- layoutMode: "VERTICAL" or "HORIZONTAL" = flex-direction
- itemSpacing: gap between children
- paddingTop/Right/Bottom/Left: padding
- fills: array of fill objects (type "SOLID" with color {r,g,b,a} in 0-1 range)
- cornerRadius: border-radius
- characters: text content
- fontFamily, fontSize, fontWeight: text styles
- layoutSizingHorizontal/Vertical: "FILL" = width/height 100%, "HUG" = fit-content, "FIXED" = use absolute value
- clipsContent: overflow hidden
- visible: false = display none

Requirements:
- Output ONLY the HTML code, nothing else. No markdown fences, no explanations.
- Use inline CSS styles (no external stylesheets).
- Convert Figma properties to CSS equivalents exactly.
- Colors are in 0-1 range: multiply by 255 for RGB.
- For image fills (type "IMAGE"), use a colored placeholder div.
- Include a reset style: * { margin: 0; padding: 0; box-sizing: border-box; }

Figma JSON:
${input}`,
};

async function runOne(name: string, input: string, prompt: (i: string) => string, client: Anthropic) {
  console.error(`  Running ${name}... (input: ${Math.ceil(input.length/4)} est. tokens)`);
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "enabled", budget_tokens: BUDGET_TOKENS },
    messages: [{ role: "user", content: prompt(input) }],
  });
  const response = await stream.finalMessage();

  let thinkingText = "";
  let html = "";
  for (const block of response.content) {
    if (block.type === "thinking") thinkingText += block.thinking;
    else if (block.type === "text") html += block.text;
  }

  html = html.trim();
  if (html.startsWith("```html")) html = html.slice(7);
  else if (html.startsWith("```")) html = html.slice(3);
  if (html.endsWith("```")) html = html.slice(0, -3);
  html = html.trim();

  return {
    thinkingTokens: Math.ceil(thinkingText.length / 4),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    html,
  };
}

async function measureSimilarity(html: string, name: string, figmaScreenshot: string): Promise<number> {
  const outputDir = join(RUN_DIR, `vc-${name}`);
  mkdirSync(outputDir, { recursive: true });

  const htmlPath = join(RUN_DIR, `${name}.html`);
  writeFileSync(htmlPath, html);

  const figmaPng = PNG.sync.read(readFileSync(figmaScreenshot));
  const exportScale = 2;
  const logicalW = Math.max(1, Math.round(figmaPng.width / exportScale));
  const logicalH = Math.max(1, Math.round(figmaPng.height / exportScale));

  const codePngPath = join(outputDir, "code.png");
  await renderCodeScreenshot(resolve(htmlPath), codePngPath, { width: logicalW, height: logicalH }, exportScale);

  copyFileSync(figmaScreenshot, join(outputDir, "figma.png"));
  const result = compareScreenshots(join(outputDir, "figma.png"), codePngPath, join(outputDir, "diff.png"));
  return result.similarity;
}

async function main() {
  const client = new Anthropic();
  mkdirSync(RUN_DIR, { recursive: true });

  const figmaScreenshot = resolve(`${FIXTURE}/screenshot.png`);
  const designTree = readFileSync("/tmp/ablation-trees/ablation-large-good.txt", "utf-8");
  const figmaRaw = readFileSync("/tmp/figma-raw-compact.json", "utf-8");

  // design-tree already measured: thinking=24, input=~11K, output=17397, similarity=94%
  const methods = [
    { name: "figma-raw", input: figmaRaw, prompt: PROMPTS["figma-raw"]! },
  ];

  const results: Record<string, any> = {};

  for (const method of methods) {
    console.error(`\n=== ${method.name} ===`);
    const result = await runOne(method.name, method.input, method.prompt, client);
    console.error(`  thinking=${result.thinkingTokens}, input=${result.inputTokens}, output=${result.outputTokens}`);

    const similarity = await measureSimilarity(result.html, method.name, figmaScreenshot);
    console.error(`  similarity=${similarity}%`);

    results[method.name] = { ...result, similarity };
  }

  // Summary
  console.error("\n=== Comparison ===");
  console.error("| Method | Input tokens | Thinking | Output tokens | Similarity |");
  console.error("|---|---|---|---|---|");
  for (const [name, r] of Object.entries(results)) {
    console.error(`| ${name} | ${r.inputTokens} | ${r.thinkingTokens} | ${r.outputTokens} | ${r.similarity}% |`);
  }

  writeFileSync(join(RUN_DIR, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main();
