/**
 * HTML extraction and processing utilities.
 * Shared by calibration pipeline and experiment scripts.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Extract HTML from LLM markdown response text.
 * Tries three strategies: full document → body tag → largest block.
 */
export function extractHtml(text: string): { html: string; method: string } {
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

/**
 * Remove scripts and event handlers from HTML for safe rendering.
 */
export function sanitizeHtml(html: string): string {
  let result = html;
  result = result.replace(/^\/\/\s*filename:.*\n/i, "");
  result = result.replace(/<script[\s\S]*?<\/script>/gi, "");
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  result = result.replace(
    /\s+(href|src|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi,
    (_, attr) => ` ${attr}="#"`,
  );
  return result;
}

/**
 * Replace Google Fonts CDN links with a local Inter font-face declaration.
 */
export function injectLocalFont(html: string): string {
  const fontPath = resolve("assets/fonts/Inter.var.woff2");
  if (!existsSync(fontPath)) return html;
  const fontUrl = pathToFileURL(fontPath).href;
  const fontCss = `@font-face { font-family: "Inter"; src: url("${fontUrl}") format("woff2"); font-weight: 100 900; }`;
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

/** Full pipeline: extract → sanitize → inject font */
export function processHtml(responseText: string): { html: string; method: string } {
  const { html: raw, method } = extractHtml(responseText);
  const html = injectLocalFont(sanitizeHtml(raw));
  return { html, method };
}
