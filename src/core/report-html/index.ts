// Report HTML module — full page generation for CLI
// Rendering logic lives in render.ts (shared with web/plugin)

import type { AnalysisFile } from "../contracts/figma-node.js";
import type { AnalysisResult } from "../engine/rule-engine.js";
import type { ScoreReport } from "../engine/scoring.js";
import { escapeHtml } from "../ui-helpers.js";
import { renderReportBody } from "./render.js";
import type { ReportData } from "./render.js";

export type { ReportData } from "./render.js";
export { renderReportBody } from "./render.js";

export interface NodeScreenshot {
  nodeId: string;
  nodePath: string;
  screenshotBase64: string;
  issueCount: number;
  topSeverity: string;
}

export interface HtmlReportOptions {
  nodeScreenshots?: NodeScreenshot[];
  figmaToken?: string | undefined;
}

const esc = escapeHtml;

/**
 * Generate a complete standalone HTML report page.
 * Used by CLI — opens in browser.
 */
export function generateHtmlReport(
  file: AnalysisFile,
  result: AnalysisResult,
  scores: ScoreReport,
  options?: HtmlReportOptions
): string {
  const figmaToken = options?.figmaToken;

  const data: ReportData = {
    fileName: file.name,
    fileKey: file.fileKey,
    scores,
    issues: result.issues,
    nodeCount: result.nodeCount,
    maxDepth: result.maxDepth,
    ...(figmaToken && { figmaToken }),
  };

  return `<!DOCTYPE html>
<html lang="en" class="antialiased">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CanICode Report — ${esc(file.name)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'] },
          colors: {
            border: 'hsl(240 5.9% 90%)',
            ring: 'hsl(240 5.9% 10%)',
            background: 'hsl(0 0% 100%)',
            foreground: 'hsl(240 10% 3.9%)',
            muted: { DEFAULT: 'hsl(240 4.8% 95.9%)', foreground: 'hsl(240 3.8% 46.1%)' },
            card: { DEFAULT: 'hsl(0 0% 100%)', foreground: 'hsl(240 10% 3.9%)' },
          },
          borderRadius: { lg: '0.5rem', md: 'calc(0.5rem - 2px)', sm: 'calc(0.5rem - 4px)' },
        }
      }
    }
  </script>
  <style>
    details summary::-webkit-details-marker { display: none; }
    details summary::marker { content: ""; }
    details summary { list-style: none; }
    .gauge-fill { transition: stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1); }
    @media print {
      .no-print { display: none !important; }
      .topbar-print { position: static !important; background: white !important; color: hsl(240 10% 3.9%) !important; }
    }
  </style>
</head>
<body class="bg-muted font-sans text-foreground min-h-screen">

  <!-- Top Bar -->
  <header class="topbar-print sticky top-0 z-50 bg-zinc-950 text-white border-b border-zinc-800">
    <div class="max-w-[960px] mx-auto px-6 py-3 flex items-center gap-4">
      <span class="font-semibold text-sm tracking-tight">CanICode</span>
      <span class="text-zinc-400 text-sm truncate">${esc(file.name)}</span>
      <span class="ml-auto text-zinc-500 text-xs no-print">${new Date().toLocaleDateString()}</span>
    </div>
  </header>

  <main class="max-w-[960px] mx-auto px-6 pb-16">
${renderReportBody(data)}
  </main>

${figmaToken ? renderFigmaCommentScript(figmaToken) : ""}
</body>
</html>`;
}

function renderFigmaCommentScript(figmaToken: string): string {
  return `  <script>
    const FIGMA_TOKEN = '${figmaToken}';
    async function postComment(btn) {
      const fileKey = btn.dataset.fileKey;
      const nodeId = btn.dataset.nodeId.replace(/-/g, ':');
      const message = btn.dataset.message;
      const commentBody = '[CanICode] ' + message;
      btn.disabled = true;
      btn.textContent = 'Sending...';
      btn.title = '';
      try {
        const res = await fetch('https://api.figma.com/v1/files/' + fileKey + '/comments', {
          method: 'POST',
          headers: { 'X-FIGMA-TOKEN': FIGMA_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: commentBody, client_meta: { node_id: nodeId, node_offset: { x: 0, y: 0 } } }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          const errMsg = res.status === 400 ? 'Bad request' : res.status === 403 ? 'Token lacks file access' : res.status === 404 ? 'File not found' : res.status === 429 ? 'Rate limited' : 'HTTP ' + res.status;
          throw new Error(errMsg + (errBody ? ': ' + errBody.slice(0, 100) : ''));
        }
        btn.textContent = 'Sent \\u2713';
        btn.classList.remove('hover:bg-muted');
        btn.classList.add('text-green-600', 'border-green-500/30');
      } catch (e) {
        btn.textContent = 'Failed';
        btn.title = e.message || String(e);
        btn.classList.remove('hover:bg-muted');
        btn.classList.add('text-red-600', 'border-red-500/30');
        btn.disabled = false;
      }
    }
  </script>`;
}
