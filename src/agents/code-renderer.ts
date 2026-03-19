import { chromium } from "playwright";

/**
 * Render generated HTML/CSS/React code to a PNG screenshot using Playwright.
 * Returns base64-encoded PNG.
 */
export async function renderCodeToScreenshot(
  generatedCode: string,
  options?: { width?: number; height?: number }
): Promise<string> {
  const width = options?.width ?? 800;
  const height = options?.height ?? 600;

  // Wrap the generated code in a minimal HTML page
  const html = buildHtmlWrapper(generatedCode);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width, height },
    });

    await page.setContent(html, { waitUntil: "networkidle" });

    // Auto-detect content height for full-page capture
    const bodyHeight = await page.evaluate("document.body.scrollHeight") as number;
    const captureHeight = Math.max(height, bodyHeight);

    const buffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height: captureHeight },
    });

    return Buffer.from(buffer).toString("base64");
  } finally {
    await browser.close();
  }
}

/**
 * Render multiple code snippets in a batch, reusing a single browser instance.
 */
export async function renderCodeBatch(
  items: Array<{ nodeId: string; generatedCode: string }>,
  options?: { width?: number; height?: number }
): Promise<Map<string, string>> {
  const width = options?.width ?? 800;
  const height = options?.height ?? 600;
  const results = new Map<string, string>();

  const browser = await chromium.launch({ headless: true });
  try {
    for (const item of items) {
      try {
        const page = await browser.newPage({
          viewport: { width, height },
        });

        const html = buildHtmlWrapper(item.generatedCode);
        await page.setContent(html, { waitUntil: "networkidle" });

        const bodyHeight = await page.evaluate("document.body.scrollHeight") as number;
        const captureHeight = Math.max(height, bodyHeight);

        const buffer = await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width, height: captureHeight },
        });

        results.set(item.nodeId, Buffer.from(buffer).toString("base64"));
        await page.close();
      } catch {
        // Skip nodes where rendering fails
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Wrap generated code in a minimal HTML document.
 * Handles raw HTML, HTML with style tags, and basic React JSX.
 */
function buildHtmlWrapper(code: string): string {
  // If the code already looks like a full HTML document, use it directly
  if (code.trimStart().toLowerCase().startsWith("<!doctype") || code.trimStart().startsWith("<html")) {
    return code;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
${code}
</body>
</html>`;
}
