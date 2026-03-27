import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderCodeScreenshot } from "../src/core/engine/visual-compare.js";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 64000;
const BUDGET_TOKENS = 10000;
const RUN_DIR = "logs/ablation/mcp-comparison--2026-03-27";

async function main() {
  const client = new Anthropic();
  mkdirSync(RUN_DIR, { recursive: true });

  const mpcCode = readFileSync("/tmp/figma-mcp-good.txt", "utf-8");
  const figmaScreenshot = resolve("fixtures/ablation-large-good/screenshot.png");

  const prompt = `You are a frontend developer. Convert the following React+Tailwind component code (from Figma) into a single, self-contained HTML file.

Requirements:
- Output ONLY the HTML code, nothing else. No markdown fences, no explanations.
- Convert all React components to plain HTML elements.
- Convert all Tailwind classes to equivalent inline CSS styles.
- Replace all image URLs with colored placeholder divs of appropriate size.
- Include a reset style: * { margin: 0; padding: 0; box-sizing: border-box; }
- Render the full page as a single flat HTML file.

React+Tailwind code from Figma:
${mpcCode}`;

  console.error("=== figma-mcp (good) ===");
  console.error(`  input: ~${Math.ceil(prompt.length / 4)} est. tokens`);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "enabled", budget_tokens: BUDGET_TOKENS },
    messages: [{ role: "user", content: prompt }],
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

  const thinkingTokens = Math.ceil(thinkingText.length / 4);
  console.error(`  thinking=${thinkingTokens}, input=${response.usage.input_tokens}, output=${response.usage.output_tokens}`);

  // Visual compare
  const htmlPath = join(RUN_DIR, "mcp-good.html");
  writeFileSync(htmlPath, html);
  const vcDir = join(RUN_DIR, "vc-mcp-good");
  mkdirSync(vcDir, { recursive: true });

  const figmaPng = PNG.sync.read(readFileSync(figmaScreenshot));
  const scale = 2;
  const w = Math.max(1, Math.round(figmaPng.width / scale));
  const h = Math.max(1, Math.round(figmaPng.height / scale));

  const codePng = join(vcDir, "code.png");
  await renderCodeScreenshot(resolve(htmlPath), codePng, { width: w, height: h }, scale);
  copyFileSync(figmaScreenshot, join(vcDir, "figma.png"));
  const vcResult = compareScreenshots(join(vcDir, "figma.png"), codePng, join(vcDir, "diff.png"));

  console.error(`  similarity=${vcResult.similarity}%`);

  const result = {
    thinkingTokens,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    similarity: vcResult.similarity,
  };

  writeFileSync(join(RUN_DIR, "results.json"), JSON.stringify(result, null, 2));

  console.error("\n=== 3-way comparison (good fixture) ===");
  console.error("| Method | Input tokens | Thinking | Output tokens | Similarity |");
  console.error("|---|---|---|---|---|");
  console.error(`| design-tree | ~11,000 | 24 | 17,397 | 94% |`);
  console.error(`| figma-raw | 58,898 | 615 | 10,944 | 78% |`);
  console.error(`| figma-mcp | ${result.inputTokens} | ${result.thinkingTokens} | ${result.outputTokens} | ${result.similarity}% |`);

  console.log(JSON.stringify(result, null, 2));
}

main();
