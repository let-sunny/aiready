// Report HTML module - Lighthouse-style HTML report generation

import type { AnalysisFile } from "../contracts/figma-node.js";
import type { Category } from "../contracts/category.js";
import type { Severity } from "../contracts/severity.js";
import { CATEGORIES, CATEGORY_LABELS } from "../contracts/category.js";
import { SEVERITY_LABELS } from "../contracts/severity.js";
import type { AnalysisResult, AnalysisIssue } from "../core/rule-engine.js";
import type { ScoreReport, Grade } from "../core/scoring.js";
import { gradeToClassName } from "../core/scoring.js";
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

// Lighthouse color palette
const LH_GREEN = "#0cce6b";
const LH_ORANGE = "#ffa400";
const LH_RED = "#ff4e42";
const LH_GRAY = "#c7c7c7";

// Gauge geometry
const GAUGE_RADIUS = 53;
const GAUGE_CIRCUMFERENCE = Math.round(2 * Math.PI * GAUGE_RADIUS); // ~333

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
    return `      <div class="lh-gauge-category">
${renderGauge(catScore.percentage, CATEGORY_LABELS[cat], false)}
        <div class="lh-gauge-issues">${catScore.issueCount} issues</div>
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
  const gradeClass = grade ? ` grade-${gradeToClassName(grade)}` : "";
  const gradeHtml = grade ? `\n        <text x="60" y="82" class="lh-gauge__grade">${escapeHtml(grade)}</text>` : "";

  return `      <div class="lh-gauge ${sizeClass}${gradeHtml ? gradeClass : ""}">
        <svg viewBox="0 0 120 120" class="lh-gauge__svg">
          <circle class="lh-gauge__track" cx="60" cy="60" r="${GAUGE_RADIUS}" />
          <circle class="lh-gauge__fill" cx="60" cy="60" r="${GAUGE_RADIUS}"
            stroke="${color}"
            stroke-dasharray="${GAUGE_CIRCUMFERENCE}"
            stroke-dashoffset="${offset}"
            transform="rotate(-90 60 60)" />
          <text x="60" y="${grade ? "65" : "68"}" class="lh-gauge__score">${percentage}</text>${gradeHtml}
        </svg>
        <div class="lh-gauge__label">${escapeHtml(label)}</div>
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
            <h2 class="lh-category-name">${CATEGORY_LABELS[category]}</h2>
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
    /* ===== Reset & Base ===== */
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #3d3d3d;
      background: #fff;
      -webkit-font-smoothing: antialiased;
    }

    /* ===== Dark Top Bar (Lighthouse nav) ===== */
    .lh-topbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #212121;
      color: #fff;
      padding: 12px 0;
    }

    .lh-topbar__inner {
      max-width: 960px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .lh-topbar__title {
      font-weight: 700;
      font-size: 18px;
      letter-spacing: 0.5px;
    }

    .lh-topbar__url {
      font-size: 14px;
      color: #b0b0b0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ===== Container ===== */
    .lh-container {
      max-width: 960px;
      margin: 0 auto;
      padding: 0 24px 48px;
    }

    /* ===== Overall Gauge Section ===== */
    .lh-gauge-section {
      display: flex;
      justify-content: center;
      padding: 40px 0 16px;
    }

    .lh-gauge-overall {
      text-align: center;
    }

    /* ===== Category Gauges Row ===== */
    .lh-category-gauges {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 0 32px;
    }

    .lh-gauge-category {
      text-align: center;
      min-width: 100px;
    }

    .lh-gauge-issues {
      font-size: 11px;
      color: #757575;
      margin-top: -4px;
    }

    /* ===== SVG Gauge ===== */
    .lh-gauge {
      display: inline-block;
    }

    .lh-gauge--large .lh-gauge__svg {
      width: 176px;
      height: 176px;
    }

    .lh-gauge--small .lh-gauge__svg {
      width: 96px;
      height: 96px;
    }

    .lh-gauge__track {
      fill: none;
      stroke: #e8e8e8;
      stroke-width: 8;
    }

    .lh-gauge__fill {
      fill: none;
      stroke-width: 8;
      stroke-linecap: round;
      transition: stroke-dashoffset 1s ease-out;
    }

    .lh-gauge__score {
      font-size: 32px;
      font-weight: 700;
      fill: #3d3d3d;
      text-anchor: middle;
      dominant-baseline: central;
    }

    .lh-gauge__grade {
      font-size: 14px;
      font-weight: 600;
      fill: #757575;
      text-anchor: middle;
    }

    .lh-gauge__label {
      font-size: 13px;
      font-weight: 500;
      color: #3d3d3d;
      margin-top: 4px;
      text-align: center;
    }

    .lh-gauge--large .lh-gauge__label {
      font-size: 16px;
      font-weight: 600;
    }

    /* ===== Inline Gauge (Category Headers) ===== */
    .lh-gauge__svg--inline {
      width: 40px;
      height: 40px;
    }

    .lh-gauge__svg--inline .lh-gauge__track {
      stroke-width: 10;
    }

    .lh-gauge__svg--inline .lh-gauge__fill {
      stroke-width: 10;
    }

    .lh-gauge__score--inline {
      font-size: 36px;
      font-weight: 700;
      fill: #3d3d3d;
      text-anchor: middle;
      dominant-baseline: central;
    }

    /* ===== Issue Summary Bar ===== */
    .lh-summary-bar {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 24px;
      padding: 16px 24px;
      background: #f7f7f7;
      border-radius: 8px;
      margin-bottom: 24px;
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
      color: #3d3d3d;
    }

    .lh-summary-label {
      font-size: 13px;
      color: #757575;
    }

    .lh-summary-total {
      padding-left: 16px;
      border-left: 1px solid #e0e0e0;
    }

    /* ===== Section (generic card) ===== */
    .lh-section {
      margin-bottom: 16px;
    }

    .lh-section__header {
      padding: 0 0 12px;
    }

    .lh-section__title {
      font-size: 18px;
      font-weight: 600;
      color: #3d3d3d;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .lh-section__title-icon {
      font-size: 12px;
    }

    .lh-section__description {
      font-size: 14px;
      color: #757575;
      margin-top: 4px;
    }

    /* ===== Opportunities ===== */
    .lh-opportunities {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }

    .lh-opportunity-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .lh-opportunity-item {
      display: grid;
      grid-template-columns: 1fr 160px;
      gap: 12px;
      align-items: center;
      padding: 12px 16px;
      border-radius: 6px;
      background: #fafafa;
      border: 1px solid #f0f0f0;
    }

    .lh-opportunity-rule {
      font-size: 14px;
      font-weight: 600;
      color: #3d3d3d;
    }

    .lh-opportunity-message {
      font-size: 13px;
      color: #757575;
      margin-top: 2px;
    }

    .lh-opportunity-path {
      font-size: 11px;
      font-family: SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
      color: #9e9e9e;
      margin-top: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lh-opportunity-bar-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .lh-opportunity-bar {
      height: 8px;
      background: ${LH_RED};
      border-radius: 4px;
      min-width: 4px;
      transition: width 0.6s ease-out;
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

    /* ===== Category Detail (Expandable) ===== */
    .lh-category-detail {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }

    .lh-category-summary {
      cursor: pointer;
      list-style: none;
      padding: 16px 24px;
      background: #fff;
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
      border-bottom: 1px solid #e0e0e0;
      background: #fafafa;
    }

    .lh-category-summary:hover {
      background: #f5f5f5;
    }

    .lh-category-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .lh-category-gauge-inline {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
    }

    .lh-category-name {
      font-size: 16px;
      font-weight: 600;
      color: #3d3d3d;
      flex: 1;
    }

    .lh-category-count {
      font-size: 13px;
      font-weight: 600;
    }

    .lh-category-chevron {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      position: relative;
    }

    .lh-category-chevron::after {
      content: "";
      position: absolute;
      top: 6px;
      left: 4px;
      width: 8px;
      height: 8px;
      border-right: 2px solid #757575;
      border-bottom: 2px solid #757575;
      transform: rotate(45deg);
      transition: transform 0.2s;
    }

    .lh-category-detail[open] .lh-category-chevron::after {
      transform: rotate(-135deg);
      top: 8px;
    }

    .lh-category-body {
      padding: 16px 24px;
      background: #fff;
    }

    .lh-no-issues {
      color: ${LH_GREEN};
      font-weight: 500;
      font-size: 14px;
      padding: 8px 0;
    }

    /* ===== Severity Group ===== */
    .lh-severity-group {
      margin-bottom: 20px;
    }

    .lh-severity-group:last-child {
      margin-bottom: 0;
    }

    .lh-severity-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      margin-bottom: 8px;
      border-bottom: 1px solid #f0f0f0;
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
      color: #3d3d3d;
    }

    .lh-severity-count {
      font-size: 12px;
      color: #757575;
      margin-left: auto;
    }

    /* ===== Issue Row ===== */
    .lh-issue-row {
      border: 1px solid #f0f0f0;
      border-radius: 6px;
      margin-bottom: 6px;
      background: #fafafa;
      overflow: hidden;
    }

    .lh-issue-row:last-child {
      margin-bottom: 0;
    }

    .lh-issue-summary {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
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
      background: #f0f0f0;
    }

    .lh-issue-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .lh-issue-rule {
      font-weight: 600;
      color: #3d3d3d;
      white-space: nowrap;
    }

    .lh-issue-message {
      flex: 1;
      color: #757575;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lh-issue-pts {
      font-size: 12px;
      font-weight: 600;
      color: #757575;
      white-space: nowrap;
      background: #eee;
      padding: 2px 8px;
      border-radius: 10px;
    }

    /* ===== Issue Detail (expanded) ===== */
    .lh-issue-detail {
      padding: 12px 14px 14px 32px;
      border-top: 1px solid #f0f0f0;
      background: #fff;
    }

    .lh-issue-path {
      font-family: SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
      font-size: 11px;
      color: #9e9e9e;
      padding: 4px 0 8px;
      word-break: break-all;
    }

    .lh-issue-meta {
      font-size: 13px;
      color: #616161;
      line-height: 1.7;
    }

    .lh-issue-meta p {
      margin: 4px 0;
    }

    .lh-issue-meta strong {
      color: #3d3d3d;
    }

    .lh-issue-screenshot {
      margin-top: 12px;
    }

    .lh-issue-screenshot img {
      max-width: 240px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    /* ===== Figma Link ===== */
    .lh-figma-link {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 500;
      color: #1a73e8;
      text-decoration: none;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background: #fff;
      transition: background 0.15s, border-color 0.15s;
    }

    .lh-figma-link:hover {
      background: #f1f3f4;
      border-color: #d0d0d0;
    }

    /* ===== Footer ===== */
    .lh-footer {
      text-align: center;
      padding: 32px 0 0;
      color: #757575;
      font-size: 13px;
      border-top: 1px solid #e0e0e0;
      margin-top: 32px;
    }

    .lh-footer strong {
      color: #3d3d3d;
    }

    .lh-footer-meta {
      font-size: 11px;
      color: #9e9e9e;
      margin-top: 4px;
    }

    /* ===== Responsive ===== */
    @media (max-width: 768px) {
      .lh-container {
        padding: 0 16px 32px;
      }

      .lh-gauge--large .lh-gauge__svg {
        width: 140px;
        height: 140px;
      }

      .lh-gauge--small .lh-gauge__svg {
        width: 72px;
        height: 72px;
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
      .lh-topbar {
        position: static;
        background: #fff;
        color: #3d3d3d;
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

      .lh-figma-link {
        color: #3d3d3d;
        border-color: #ccc;
      }
    }
  `;
}
