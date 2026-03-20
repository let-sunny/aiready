// Report HTML module - Lighthouse-style HTML report generation

import type { AnalysisFile } from "../contracts/figma-node.js";
import type { Category } from "../contracts/category.js";
import type { Severity } from "../contracts/severity.js";
import { CATEGORIES, CATEGORY_LABELS } from "../contracts/category.js";
import { SEVERITY_LABELS } from "../contracts/severity.js";
import type { AnalysisResult, AnalysisIssue } from "../core/rule-engine.js";
import type { ScoreReport, Grade } from "../core/scoring.js";
import { buildFigmaDeepLink } from "../adapters/figma-url-parser.js";

/**
 * Figma node screenshot for --visual (preview only, no comparison)
 */
export interface NodeScreenshot {
  nodeId: string;
  nodePath: string;
  screenshotBase64: string;
  issueCount: number;
  topSeverity: string;
}

export interface HtmlReportOptions {
  /** Figma node screenshots keyed by nodeId (analyze --visual) */
  nodeScreenshots?: NodeScreenshot[];
}

// shadcn/ui-inspired color palette
const LH_GREEN = "#22c55e";
const LH_ORANGE = "#f59e0b";
const LH_RED = "#ef4444";
const LH_GRAY = "#a1a1aa";

// Gauge geometry
const GAUGE_RADIUS = 53;
const GAUGE_CIRCUMFERENCE = Math.round(2 * Math.PI * GAUGE_RADIUS); // ~333

// Category descriptions for tooltips
const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  layout: "Auto Layout usage, responsive constraints, nesting depth, absolute positioning",
  token: "Design token binding for colors, fonts, shadows, spacing grid consistency",
  component: "Component reuse, detached instances, variant coverage, property usage",
  naming: "Semantic layer names, naming conventions, default/auto-generated names",
  "ai-readability": "Structure clarity for AI code generation, z-index reliance, empty frames",
  "handoff-risk": "Hardcoded values, text truncation handling, image placeholders, dev status",
};

// Severity ordering for display (highest first)
const SEVERITY_ORDER: Severity[] = ["blocking", "risk", "missing-info", "suggestion"];

// Severity dot colors (Lighthouse-inspired)
const SEVERITY_DOT_COLORS: Record<Severity, string> = {
  blocking: LH_RED,
  risk: LH_ORANGE,
  "missing-info": LH_GRAY,
  suggestion: LH_GREEN,
};

/**
 * Get Lighthouse gauge color based on percentage score
 */
function gaugeColor(percentage: number): string {
  if (percentage >= 75) return LH_GREEN;
  if (percentage >= 50) return LH_ORANGE;
  return LH_RED;
}

/**
 * Calculate stroke-dashoffset for SVG gauge
 */
function gaugeDashOffset(percentage: number): number {
  return GAUGE_CIRCUMFERENCE * (1 - percentage / 100);
}

/**
 * Generate a static HTML report with Lighthouse-style design
 */
export function generateHtmlReport(
  file: AnalysisFile,
  result: AnalysisResult,
  scores: ScoreReport,
  options?: HtmlReportOptions
): string {
  const screenshotMap = new Map(
    (options?.nodeScreenshots ?? []).map((ns) => [ns.nodeId, ns])
  );
  const quickWins = getQuickWins(result.issues, 5);
  const issuesByCategory = groupIssuesByCategory(result.issues);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AIReady Report - ${escapeHtml(file.name)}</title>
  <style>
${getStyles()}
  </style>
</head>
<body>
  <div class="lh-topbar">
    <div class="lh-topbar__inner">
      <span class="lh-topbar__title">AIReady Report</span>
      <span class="lh-topbar__url">${escapeHtml(file.name)}</span>
    </div>
  </div>

  <div class="lh-container">
    <!-- Overall Score Gauge -->
    <section class="lh-gauge-section">
      <div class="lh-gauge-overall">
${renderGauge(scores.overall.percentage, "Overall", true, scores.overall.grade)}
      </div>
    </section>

    <!-- Category Gauges Row -->
    <section class="lh-category-gauges">
${CATEGORIES.map(cat => {
    const catScore = scores.byCategory[cat];
    const desc = CATEGORY_DESCRIPTIONS[cat];
    return `      <div class="lh-gauge-category lh-tooltip-wrap">
${renderGauge(catScore.percentage, CATEGORY_LABELS[cat], false)}
        <div class="lh-gauge-issues">${catScore.issueCount} issues</div>
        <div class="lh-tooltip">${escapeHtml(desc)}</div>
      </div>`;
  }).join("\n")}
    </section>

    <!-- Issue Summary Bar -->
    <section class="lh-summary-bar">
      <div class="lh-summary-item">
        <span class="lh-summary-dot" style="background: ${LH_RED}"></span>
        <span class="lh-summary-count">${scores.summary.blocking}</span>
        <span class="lh-summary-label">Blocking</span>
      </div>
      <div class="lh-summary-item">
        <span class="lh-summary-dot" style="background: ${LH_ORANGE}"></span>
        <span class="lh-summary-count">${scores.summary.risk}</span>
        <span class="lh-summary-label">Risk</span>
      </div>
      <div class="lh-summary-item">
        <span class="lh-summary-dot" style="background: ${LH_GRAY}"></span>
        <span class="lh-summary-count">${scores.summary.missingInfo}</span>
        <span class="lh-summary-label">Missing Info</span>
      </div>
      <div class="lh-summary-item">
        <span class="lh-summary-dot" style="background: ${LH_GREEN}"></span>
        <span class="lh-summary-count">${scores.summary.suggestion}</span>
        <span class="lh-summary-label">Suggestion</span>
      </div>
      <div class="lh-summary-item lh-summary-total">
        <span class="lh-summary-count">${scores.summary.totalIssues}</span>
        <span class="lh-summary-label">Total</span>
      </div>
    </section>

${quickWins.length > 0 ? renderOpportunities(quickWins, file.fileKey, screenshotMap) : ""}

    <!-- Category Detail Sections -->
${CATEGORIES.map(cat => renderCategoryDetail(cat, scores, issuesByCategory.get(cat) ?? [], file.fileKey, screenshotMap)).join("\n")}

    <footer class="lh-footer">
      <p>Generated by <strong>AIReady</strong></p>
      <p class="lh-footer-meta">${new Date().toLocaleString()} &middot; ${result.nodeCount} nodes &middot; Max depth ${result.maxDepth}</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Render an SVG gauge circle
 */
function renderGauge(
  percentage: number,
  label: string,
  isLarge: boolean,
  grade?: Grade
): string {
  const color = gaugeColor(percentage);
  const offset = gaugeDashOffset(percentage);
  const sizeClass = isLarge ? "lh-gauge--large" : "lh-gauge--small";
  const gradeLabel = grade ? `${label} · ${grade}` : label;

  return `      <div class="lh-gauge ${sizeClass}">
        <svg viewBox="0 0 120 120" class="lh-gauge__svg">
          <circle class="lh-gauge__track" cx="60" cy="60" r="${GAUGE_RADIUS}" />
          <circle class="lh-gauge__fill" cx="60" cy="60" r="${GAUGE_RADIUS}"
            stroke="${color}"
            stroke-dasharray="${GAUGE_CIRCUMFERENCE}"
            stroke-dashoffset="${offset}"
            transform="rotate(-90 60 60)" />
          <text x="60" y="68" class="lh-gauge__score">${percentage}</text>
        </svg>
        <div class="lh-gauge__label">${escapeHtml(gradeLabel)}</div>
      </div>`;
}

/**
 * Render the Opportunities section (like Lighthouse's Opportunities)
 */
function renderOpportunities(
  issues: AnalysisIssue[],
  fileKey: string,
  screenshotMap: Map<string, NodeScreenshot>
): string {
  // Find max absolute score for bar width scaling
  const maxScore = issues.reduce(
    (max, issue) => Math.max(max, Math.abs(issue.calculatedScore)),
    1
  );

  return `
    <section class="lh-section lh-opportunities">
      <div class="lh-section__header">
        <h2 class="lh-section__title">
          <span class="lh-section__title-icon" style="color: ${LH_RED}">&#9679;</span>
          Opportunities
        </h2>
        <p class="lh-section__description">These blocking issues have the highest impact. Fix them first.</p>
      </div>
      <div class="lh-opportunity-list">
${issues.map(issue => renderOpportunityItem(issue, fileKey, screenshotMap, maxScore)).join("\n")}
      </div>
    </section>`;
}

/**
 * Render a single opportunity item with impact bar
 */
function renderOpportunityItem(
  issue: AnalysisIssue,
  fileKey: string,
  _screenshotMap: Map<string, NodeScreenshot>,
  maxScore: number
): string {
  const def = issue.rule.definition;
  const figmaLink = buildFigmaDeepLink(fileKey, issue.violation.nodeId);
  const barWidth = Math.round((Math.abs(issue.calculatedScore) / maxScore) * 100);
  const pts = issue.calculatedScore;

  return `        <div class="lh-opportunity-item">
          <div class="lh-opportunity-main">
            <div class="lh-opportunity-rule">${escapeHtml(def.name)}</div>
            <div class="lh-opportunity-message">${escapeHtml(issue.violation.message)}</div>
            <div class="lh-opportunity-path">${escapeHtml(issue.violation.nodePath)}</div>
          </div>
          <div class="lh-opportunity-bar-wrap">
            <div class="lh-opportunity-bar" style="width: ${barWidth}%"></div>
            <span class="lh-opportunity-score">${pts} pts</span>
          </div>
          <a href="${figmaLink}" target="_blank" rel="noopener" class="lh-figma-link">Open in Figma &#8594;</a>
        </div>`;
}

/**
 * Render a full category detail section
 */
function renderCategoryDetail(
  category: Category,
  scores: ScoreReport,
  issues: AnalysisIssue[],
  fileKey: string,
  screenshotMap: Map<string, NodeScreenshot>
): string {
  const catScore = scores.byCategory[category];
  const color = gaugeColor(catScore.percentage);
  const isOpen = issues.some(i => i.config.severity === "blocking" || i.config.severity === "risk");

  // Group by severity
  const bySeverity = new Map<Severity, AnalysisIssue[]>();
  for (const sev of SEVERITY_ORDER) {
    bySeverity.set(sev, []);
  }
  for (const issue of issues) {
    bySeverity.get(issue.config.severity)?.push(issue);
  }

  return `
    <section class="lh-section">
      <details class="lh-category-detail"${isOpen ? " open" : ""}>
        <summary class="lh-category-summary">
          <div class="lh-category-header">
            <div class="lh-category-gauge-inline">
              <svg viewBox="0 0 120 120" class="lh-gauge__svg--inline">
                <circle class="lh-gauge__track" cx="60" cy="60" r="${GAUGE_RADIUS}" />
                <circle class="lh-gauge__fill" cx="60" cy="60" r="${GAUGE_RADIUS}"
                  stroke="${color}"
                  stroke-dasharray="${GAUGE_CIRCUMFERENCE}"
                  stroke-dashoffset="${gaugeDashOffset(catScore.percentage)}"
                  transform="rotate(-90 60 60)" />
                <text x="60" y="68" class="lh-gauge__score--inline">${catScore.percentage}</text>
              </svg>
            </div>
            <div class="lh-category-name-wrap">
              <h2 class="lh-category-name">${CATEGORY_LABELS[category]}</h2>
              <span class="lh-category-desc">${escapeHtml(CATEGORY_DESCRIPTIONS[category])}</span>
            </div>
            <span class="lh-category-count" style="color: ${color}">${catScore.issueCount} issues</span>
            <span class="lh-category-chevron"></span>
          </div>
        </summary>
        <div class="lh-category-body">
${issues.length === 0
    ? '          <p class="lh-no-issues">No issues found - all clear!</p>'
    : SEVERITY_ORDER
        .filter(sev => {
          const sevIssues = bySeverity.get(sev);
          return sevIssues && sevIssues.length > 0;
        })
        .map(sev => {
          const sevIssues = bySeverity.get(sev);
          if (!sevIssues || sevIssues.length === 0) return "";
          return renderSeverityGroup(sev, sevIssues, fileKey, screenshotMap);
        })
        .join("\n")
  }
        </div>
      </details>
    </section>`;
}

/**
 * Render a severity group within a category
 */
function renderSeverityGroup(
  severity: Severity,
  issues: AnalysisIssue[],
  fileKey: string,
  screenshotMap: Map<string, NodeScreenshot>
): string {
  const dotColor = SEVERITY_DOT_COLORS[severity];
  return `          <div class="lh-severity-group">
            <div class="lh-severity-header">
              <span class="lh-severity-dot" style="background: ${dotColor}"></span>
              <span class="lh-severity-label">${SEVERITY_LABELS[severity]}</span>
              <span class="lh-severity-count">${issues.length}</span>
            </div>
${issues.map(issue => renderIssueRow(issue, fileKey, screenshotMap)).join("\n")}
          </div>`;
}

/**
 * Render a single issue row (Lighthouse audit item style)
 */
function renderIssueRow(
  issue: AnalysisIssue,
  fileKey: string,
  screenshotMap: Map<string, NodeScreenshot>
): string {
  const severity = issue.config.severity;
  const def = issue.rule.definition;
  const figmaLink = buildFigmaDeepLink(fileKey, issue.violation.nodeId);
  const dotColor = SEVERITY_DOT_COLORS[severity];
  const pts = issue.calculatedScore;
  const screenshot = screenshotMap.get(issue.violation.nodeId);

  const screenshotHtml = screenshot
    ? `
                  <div class="lh-issue-screenshot">
                    <a href="${figmaLink}" target="_blank" rel="noopener">
                      <img src="data:image/png;base64,${screenshot.screenshotBase64}" alt="${escapeHtml(screenshot.nodePath)}">
                    </a>
                  </div>`
    : "";

  return `            <details class="lh-issue-row">
              <summary class="lh-issue-summary">
                <span class="lh-issue-dot" style="background: ${dotColor}"></span>
                <span class="lh-issue-rule">${escapeHtml(def.name)}</span>
                <span class="lh-issue-message">${escapeHtml(issue.violation.message)}</span>
                <span class="lh-issue-pts">${pts} pts</span>
              </summary>
              <div class="lh-issue-detail">
                <div class="lh-issue-path">${escapeHtml(issue.violation.nodePath)}</div>
                <div class="lh-issue-meta">
                  <p><strong>Why:</strong> ${escapeHtml(def.why)}</p>
                  <p><strong>Impact:</strong> ${escapeHtml(def.impact)}</p>
                  <p><strong>Fix:</strong> ${escapeHtml(def.fix)}</p>
                </div>${screenshotHtml}
                <a href="${figmaLink}" target="_blank" rel="noopener" class="lh-figma-link">Open in Figma &#8594;</a>
              </div>
            </details>`;
}

// ---- Utility functions ----

function getQuickWins(issues: AnalysisIssue[], limit: number): AnalysisIssue[] {
  return issues
    .filter(issue => issue.config.severity === "blocking")
    .sort((a, b) => a.calculatedScore - b.calculatedScore)
    .slice(0, limit);
}

function groupIssuesByCategory(issues: AnalysisIssue[]): Map<Category, AnalysisIssue[]> {
  const grouped = new Map<Category, AnalysisIssue[]>();

  for (const category of CATEGORIES) {
    grouped.set(category, []);
  }

  for (const issue of issues) {
    const category = issue.rule.definition.category;
    grouped.get(category)!.push(issue);
  }

  return grouped;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---- Styles ----

function getStyles(): string {
  return `
    /* ===== shadcn/ui CSS Variables ===== */
    :root {
      --background: 0 0% 100%;
      --foreground: 240 10% 3.9%;
      --card: 0 0% 100%;
      --card-foreground: 240 10% 3.9%;
      --muted: 240 4.8% 95.9%;
      --muted-foreground: 240 3.8% 46.1%;
      --border: 240 5.9% 90%;
      --input: 240 5.9% 90%;
      --ring: 240 5.9% 10%;
      --radius: 0.5rem;
    }

    /* ===== Reset & Base ===== */
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.5;
      color: hsl(var(--foreground));
      background: hsl(240 4.8% 95.9%);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ===== Top Bar ===== */
    .lh-topbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: hsl(240 10% 3.9%);
      color: hsl(0 0% 98%);
      padding: 14px 0;
      border-bottom: 1px solid hsl(240 3.7% 15.9%);
    }

    .lh-topbar__inner {
      max-width: 900px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .lh-topbar__title {
      font-weight: 600;
      font-size: 15px;
      letter-spacing: -0.01em;
    }

    .lh-topbar__url {
      font-size: 13px;
      color: hsl(240 5% 64.9%);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ===== Container ===== */
    .lh-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 0 24px 48px;
    }

    /* ===== Overall Gauge Section ===== */
    .lh-gauge-section {
      display: flex;
      justify-content: center;
      padding: 48px 0 20px;
    }

    .lh-gauge-overall {
      text-align: center;
    }

    /* ===== Category Gauges Row ===== */
    .lh-category-gauges {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 8px 0 32px;
    }

    .lh-gauge-category {
      text-align: center;
      min-width: 110px;
    }

    .lh-gauge-issues {
      font-size: 11px;
      color: hsl(var(--muted-foreground));
      margin-top: -2px;
    }

    /* ===== Tooltip ===== */
    .lh-tooltip-wrap {
      position: relative;
      cursor: default;
    }

    .lh-tooltip {
      display: none;
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: hsl(240 10% 3.9%);
      color: hsl(0 0% 98%);
      font-size: 12px;
      line-height: 1.5;
      padding: 8px 12px;
      border-radius: var(--radius);
      white-space: nowrap;
      z-index: 10;
      pointer-events: none;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
    }

    .lh-tooltip::after {
      content: "";
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: hsl(240 10% 3.9%);
    }

    .lh-tooltip-wrap:hover .lh-tooltip {
      display: block;
    }

    /* ===== SVG Gauge ===== */
    .lh-gauge {
      display: inline-block;
    }

    .lh-gauge--large .lh-gauge__svg {
      width: 160px;
      height: 160px;
    }

    .lh-gauge--small .lh-gauge__svg {
      width: 88px;
      height: 88px;
    }

    .lh-gauge__track {
      fill: none;
      stroke: hsl(var(--border));
      stroke-width: 8;
    }

    .lh-gauge__fill {
      fill: none;
      stroke-width: 8;
      stroke-linecap: round;
    }

    .lh-gauge__score {
      font-size: 30px;
      font-weight: 700;
      fill: hsl(var(--foreground));
      text-anchor: middle;
      dominant-baseline: central;
      letter-spacing: -0.02em;
    }

    .lh-gauge__label {
      font-size: 13px;
      font-weight: 500;
      color: hsl(var(--foreground));
      margin-top: 6px;
      text-align: center;
    }

    .lh-gauge--large .lh-gauge__label {
      font-size: 14px;
      font-weight: 600;
    }

    /* ===== Inline Gauge (Category Headers) ===== */
    .lh-gauge__svg--inline {
      width: 36px;
      height: 36px;
    }

    .lh-gauge__svg--inline .lh-gauge__track {
      stroke-width: 10;
    }

    .lh-gauge__svg--inline .lh-gauge__fill {
      stroke-width: 10;
    }

    .lh-gauge__score--inline {
      font-size: 34px;
      font-weight: 700;
      fill: hsl(var(--foreground));
      text-anchor: middle;
      dominant-baseline: central;
    }

    /* ===== Issue Summary Bar (shadcn Card) ===== */
    .lh-summary-bar {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 24px;
      padding: 16px 24px;
      background: hsl(var(--card));
      border: 1px solid hsl(var(--border));
      border-radius: var(--radius);
      margin-bottom: 24px;
      box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
    }

    .lh-summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .lh-summary-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .lh-summary-count {
      font-size: 20px;
      font-weight: 700;
      color: hsl(var(--foreground));
      letter-spacing: -0.02em;
    }

    .lh-summary-label {
      font-size: 13px;
      color: hsl(var(--muted-foreground));
    }

    .lh-summary-total {
      padding-left: 16px;
      border-left: 1px solid hsl(var(--border));
    }

    /* ===== Section ===== */
    .lh-section {
      margin-bottom: 12px;
    }

    .lh-section__header {
      padding: 0 0 12px;
    }

    .lh-section__title {
      font-size: 16px;
      font-weight: 600;
      color: hsl(var(--foreground));
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: -0.01em;
    }

    .lh-section__title-icon {
      font-size: 12px;
    }

    .lh-section__description {
      font-size: 14px;
      color: hsl(var(--muted-foreground));
      margin-top: 4px;
    }

    /* ===== Opportunities (shadcn Card) ===== */
    .lh-opportunities {
      background: hsl(var(--card));
      border: 1px solid hsl(var(--border));
      border-radius: var(--radius);
      padding: 20px 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
    }

    .lh-opportunity-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .lh-opportunity-item {
      display: grid;
      grid-template-columns: 1fr 160px;
      gap: 12px;
      align-items: center;
      padding: 12px 16px;
      border-radius: calc(var(--radius) - 2px);
      background: hsl(var(--muted));
      border: 1px solid hsl(var(--border));
    }

    .lh-opportunity-rule {
      font-size: 14px;
      font-weight: 600;
      color: hsl(var(--foreground));
      letter-spacing: -0.01em;
    }

    .lh-opportunity-message {
      font-size: 13px;
      color: hsl(var(--muted-foreground));
      margin-top: 2px;
    }

    .lh-opportunity-path {
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: hsl(var(--muted-foreground));
      margin-top: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.7;
    }

    .lh-opportunity-bar-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .lh-opportunity-bar {
      height: 8px;
      background: ${LH_RED};
      border-radius: 9999px;
      min-width: 4px;
    }

    .lh-opportunity-score {
      font-size: 12px;
      font-weight: 600;
      color: ${LH_RED};
      white-space: nowrap;
    }

    .lh-opportunity-item .lh-figma-link {
      grid-column: 1 / -1;
    }

    /* ===== Category Detail (shadcn Card + Collapsible) ===== */
    .lh-category-detail {
      border: 1px solid hsl(var(--border));
      border-radius: var(--radius);
      overflow: hidden;
      background: hsl(var(--card));
      box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
    }

    .lh-category-summary {
      cursor: pointer;
      list-style: none;
      padding: 14px 20px;
      background: hsl(var(--card));
      border-bottom: 1px solid transparent;
      transition: background 0.15s;
    }

    .lh-category-summary::-webkit-details-marker {
      display: none;
    }

    .lh-category-summary::marker {
      content: "";
    }

    .lh-category-detail[open] .lh-category-summary {
      border-bottom: 1px solid hsl(var(--border));
    }

    .lh-category-summary:hover {
      background: hsl(var(--muted));
    }

    .lh-category-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .lh-category-gauge-inline {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
    }

    .lh-category-name-wrap {
      flex: 1;
    }

    .lh-category-name {
      font-size: 14px;
      font-weight: 600;
      color: hsl(var(--foreground));
      letter-spacing: -0.01em;
    }

    .lh-category-desc {
      display: block;
      font-size: 12px;
      font-weight: 400;
      color: hsl(var(--muted-foreground));
      margin-top: 1px;
    }

    .lh-category-count {
      font-size: 13px;
      font-weight: 600;
    }

    .lh-category-chevron {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      position: relative;
    }

    .lh-category-chevron::after {
      content: "";
      position: absolute;
      top: 4px;
      left: 3px;
      width: 7px;
      height: 7px;
      border-right: 1.5px solid hsl(var(--muted-foreground));
      border-bottom: 1.5px solid hsl(var(--muted-foreground));
      transform: rotate(45deg);
      transition: transform 0.2s;
    }

    .lh-category-detail[open] .lh-category-chevron::after {
      transform: rotate(-135deg);
      top: 6px;
    }

    .lh-category-body {
      padding: 16px 20px;
      background: hsl(var(--card));
    }

    .lh-no-issues {
      color: ${LH_GREEN};
      font-weight: 500;
      font-size: 14px;
      padding: 8px 0;
    }

    /* ===== Severity Group ===== */
    .lh-severity-group {
      margin-bottom: 16px;
    }

    .lh-severity-group:last-child {
      margin-bottom: 0;
    }

    .lh-severity-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      margin-bottom: 6px;
      border-bottom: 1px solid hsl(var(--border));
    }

    .lh-severity-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .lh-severity-label {
      font-size: 13px;
      font-weight: 600;
      color: hsl(var(--foreground));
    }

    .lh-severity-count {
      font-size: 12px;
      color: hsl(var(--muted-foreground));
      margin-left: auto;
    }

    /* ===== Issue Row ===== */
    .lh-issue-row {
      border: 1px solid hsl(var(--border));
      border-radius: calc(var(--radius) - 2px);
      margin-bottom: 4px;
      background: hsl(var(--card));
      overflow: hidden;
    }

    .lh-issue-row:last-child {
      margin-bottom: 0;
    }

    .lh-issue-summary {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      cursor: pointer;
      list-style: none;
      font-size: 13px;
    }

    .lh-issue-summary::-webkit-details-marker {
      display: none;
    }

    .lh-issue-summary::marker {
      content: "";
    }

    .lh-issue-summary:hover {
      background: hsl(var(--muted));
    }

    .lh-issue-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .lh-issue-rule {
      font-weight: 600;
      color: hsl(var(--foreground));
      white-space: nowrap;
      font-size: 13px;
    }

    .lh-issue-message {
      flex: 1;
      color: hsl(var(--muted-foreground));
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
    }

    .lh-issue-pts {
      font-size: 11px;
      font-weight: 500;
      color: hsl(var(--muted-foreground));
      white-space: nowrap;
      background: hsl(var(--muted));
      padding: 2px 8px;
      border-radius: 9999px;
      border: 1px solid hsl(var(--border));
    }

    /* ===== Issue Detail (expanded) ===== */
    .lh-issue-detail {
      padding: 12px 12px 14px 30px;
      border-top: 1px solid hsl(var(--border));
      background: hsl(var(--muted));
    }

    .lh-issue-path {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      color: hsl(var(--muted-foreground));
      padding: 4px 0 8px;
      word-break: break-all;
    }

    .lh-issue-meta {
      font-size: 13px;
      color: hsl(var(--muted-foreground));
      line-height: 1.7;
    }

    .lh-issue-meta p {
      margin: 4px 0;
    }

    .lh-issue-meta strong {
      color: hsl(var(--foreground));
    }

    .lh-issue-screenshot {
      margin-top: 12px;
    }

    .lh-issue-screenshot img {
      max-width: 240px;
      border: 1px solid hsl(var(--border));
      border-radius: calc(var(--radius) - 2px);
    }

    /* ===== Figma Link (shadcn Button outline variant) ===== */
    .lh-figma-link {
      display: inline-flex;
      align-items: center;
      margin-top: 10px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      color: hsl(var(--foreground));
      text-decoration: none;
      border: 1px solid hsl(var(--input));
      border-radius: var(--radius);
      background: hsl(var(--background));
      transition: background 0.15s, color 0.15s;
      line-height: 1;
    }

    .lh-figma-link:hover {
      background: hsl(var(--muted));
    }

    /* ===== Footer ===== */
    .lh-footer {
      text-align: center;
      padding: 32px 0 0;
      color: hsl(var(--muted-foreground));
      font-size: 13px;
      border-top: 1px solid hsl(var(--border));
      margin-top: 32px;
    }

    .lh-footer strong {
      color: hsl(var(--foreground));
    }

    .lh-footer-meta {
      font-size: 11px;
      color: hsl(var(--muted-foreground));
      margin-top: 4px;
      opacity: 0.7;
    }

    /* ===== Responsive ===== */
    @media (max-width: 768px) {
      .lh-container {
        padding: 0 16px 32px;
      }

      .lh-gauge--large .lh-gauge__svg {
        width: 128px;
        height: 128px;
      }

      .lh-gauge--small .lh-gauge__svg {
        width: 68px;
        height: 68px;
      }

      .lh-category-gauges {
        gap: 4px;
      }

      .lh-gauge-category {
        min-width: 80px;
      }

      .lh-gauge__label {
        font-size: 11px;
      }

      .lh-summary-bar {
        gap: 16px;
        padding: 12px 16px;
      }

      .lh-summary-count {
        font-size: 16px;
      }

      .lh-opportunity-item {
        grid-template-columns: 1fr;
      }

      .lh-category-body {
        padding: 12px 16px;
      }

      .lh-issue-summary {
        flex-wrap: wrap;
      }

      .lh-issue-message {
        white-space: normal;
        flex-basis: 100%;
        order: 3;
        margin-left: 18px;
      }

      .lh-issue-detail {
        padding-left: 18px;
      }
    }

    /* ===== Print ===== */
    @media print {
      body {
        background: #fff;
      }

      .lh-topbar {
        position: static;
        background: #fff;
        color: hsl(var(--foreground));
        border-bottom: 1px solid hsl(var(--border));
      }

      .lh-category-detail {
        break-inside: avoid;
      }

      details[open] > summary ~ * {
        display: block !important;
      }

      .lh-category-chevron {
        display: none;
      }
    }
  `;
}
