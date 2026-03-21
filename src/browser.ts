// Browser entry point — exports analysis functions for client-side use
// All imports here must be pure functions with no Node.js dependencies

export { analyzeFile } from "./core/rule-engine.js";
export type { AnalysisResult, AnalysisIssue, RuleEngineOptions } from "./core/rule-engine.js";
export { calculateScores, formatScoreSummary, getCategoryLabel, getSeverityLabel, gradeToClassName } from "./core/scoring.js";
export type { ScoreReport, CategoryScoreResult, Grade } from "./core/scoring.js";
export { transformFigmaResponse } from "./adapters/figma-transformer.js";
export { parseFigmaUrl, buildFigmaDeepLink } from "./adapters/figma-url-parser.js";
export type { FigmaUrlInfo } from "./adapters/figma-url-parser.js";
export { CATEGORIES, CATEGORY_LABELS } from "./contracts/category.js";
export type { Category } from "./contracts/category.js";
export { SEVERITY_LABELS } from "./contracts/severity.js";
export type { Severity } from "./contracts/severity.js";
export type { AnalysisFile, AnalysisNode } from "./contracts/figma-node.js";
export type { RuleId } from "./contracts/rule.js";

// Import rules to register them with the global registry
import "./rules/index.js";
