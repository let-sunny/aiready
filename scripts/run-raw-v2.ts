import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderCodeScreenshot } from "../src/core/engine/visual-compare.js";
import { compareScreenshots } from "../src/core/engine/visual-compare-helpers.js";
import { PNG } from "pngjs";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 64000;
const BUDGET_TOKENS = 10000;
const RUN_DIR = "logs/ablation/figma-raw-v2--2026-03-27";

const FIXTURES = ["good", "bad-structure", "bad-token", "bad-component", "bad-naming", "bad-behavior", "all-bad"];

function buildPrompt(input: string): string {
  return `You are a frontend developer. Convert the following Figma REST API JSON into a single, self-contained HTML file.

CRITICAL: The root element MUST be exactly 375px wide. This is a mobile design at 375px viewport width. Do not exceed this width. All children must fit within 375px.

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
- The root container must be width: 375px with overflow: hidden.
- Convert ALL nodes in the JSON tree to HTML elements. Do not skip any sections.
- Convert Figma properties to CSS equivalents exactly.
- Colors are in 0-1 range: multiply by 255 for RGB.
- For image fills (type "IMAGE"), use a colored placeholder div.
- Include a reset style: * { margin: 0; padding: 0; box-sizing: border-box; }

Figma JSON:
${input}`;
}

async function main() {
  const client = new Anthropic();
  mkdirSync(RUN_DIR, { recursive: true });
  const results: Record<string, any> = {};

  for (const name of FIXTURES) {
    const rawJson = readFileSync(`/tmp/figma-raw-all/${name}.json`, "utf-8");
    const figmaScreenshot = resolve(`fixtures/ablation-large-${name}/screenshot.png`);

    console.error(`\n=== ${name} ===`);

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "enabled", budget_tokens: BUDGET_TOKENS },
      messages: [{ role: "user", content: buildPrompt(rawJson) }],
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
    console.error(`  thinking=${thinkingTokens}, input=${response.usage.input_tokens}, output=${response.usage.output_tokens}, stop=${response.stop_reason}`);

    const htmlPath = join(RUN_DIR, `${name}.html`);
    writeFileSync(htmlPath, html);
    const vcDir = join(RUN_DIR, `vc-${name}`);
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
    results[name] = {
      thinkingTokens,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
      similarity: vcResult.similarity,
    };
  }

  const v1: Record<string,number> = { good:78, "bad-structure":3, "bad-token":69, "bad-component":66, "bad-naming":78, "bad-behavior":80, "all-bad":73 };
  const dt: Record<string,number> = { good:94, "bad-structure":84, "bad-token":90, "bad-component":91, "bad-naming":94, "bad-behavior":94, "all-bad":84 };

  console.error("\n=== raw v1 vs v2 (375px fix) vs design-tree ===");
  console.error("| Fixture | raw v1 | raw v2 | design-tree |");
  console.error("|---|---|---|---|");
  for (const name of FIXTURES) {
    console.error(`| ${name} | ${v1[name]}% | ${results[name].similarity}% | ${dt[name]}% |`);
  }

  writeFileSync(join(RUN_DIR, "results.json"), JSON.stringify(results, null, 2));
}

main();
