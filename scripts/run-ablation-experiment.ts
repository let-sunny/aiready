import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 64000;
const BUDGET_TOKENS = 10000;
const RUN_DIR = "logs/ablation/experiment-large--2026-03-27";

const FIXTURES = [
  "ablation-large-good",
  "ablation-large-bad-structure",
  "ablation-large-bad-token",
  "ablation-large-bad-component",
  "ablation-large-bad-naming",
  "ablation-large-bad-behavior",
  "ablation-large-all-bad",
];

function buildPrompt(designTree: string): string {
  return `You are a frontend developer. Convert the following design tree into a single, self-contained HTML file.

Requirements:
- Output ONLY the HTML code, nothing else. No markdown fences, no explanations.
- Use inline CSS styles (no external stylesheets).
- Match every dimension, color, font, spacing, and layout property exactly as specified.
- Each node in the design tree maps to one HTML element.
- Use semantic HTML where appropriate (div, section, h1-h6, p, span, etc.).
- For images ([IMAGE] or url(...)), use a colored placeholder div with the same dimensions.
- Include a reset style: * { margin: 0; padding: 0; box-sizing: border-box; }

Design Tree:
${designTree}`;
}

async function runOne(name: string, client: Anthropic): Promise<{thinkingTokens: number, outputTokens: number, html: string}> {
  const tree = readFileSync(`/tmp/ablation-trees/${name}.txt`, "utf-8");
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "enabled", budget_tokens: BUDGET_TOKENS },
    messages: [{ role: "user", content: buildPrompt(tree) }],
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
    outputTokens: response.usage.output_tokens,
    html,
  };
}

async function main() {
  const client = new Anthropic();
  mkdirSync(RUN_DIR, { recursive: true });

  const results: Record<string, any> = {};

  for (const name of FIXTURES) {
    console.error(`\n=== ${name} ===`);
    const result = await runOne(name, client);
    console.error(`  thinking=${result.thinkingTokens}, output=${result.outputTokens}`);

    // Save HTML
    const htmlPath = join(RUN_DIR, `${name}.html`);
    writeFileSync(htmlPath, result.html);

    results[name] = {
      thinkingTokens: result.thinkingTokens,
      outputTokens: result.outputTokens,
    };
  }

  // Compute deltas vs good
  const good = results["ablation-large-good"];
  const deltas: Record<string, any> = {};
  for (const name of FIXTURES) {
    if (name === "ablation-large-good") continue;
    const r = results[name];
    deltas[name] = {
      ...r,
      deltaO: r.outputTokens - good.outputTokens,
      deltaO_pct: Math.round((r.outputTokens - good.outputTokens) / good.outputTokens * 100),
    };
  }

  const output = { baseline: good, deltas, raw: results };
  writeFileSync(join(RUN_DIR, "results.json"), JSON.stringify(output, null, 2));
  console.error("\n=== Results ===");
  console.error(`Baseline (good): output=${good.outputTokens}`);
  for (const [name, d] of Object.entries(deltas) as any) {
    console.error(`  ${name}: output=${d.outputTokens}, ΔO=${d.deltaO} (${d.deltaO_pct}%)`);
  }
  console.log(JSON.stringify(output, null, 2));
}

main();
