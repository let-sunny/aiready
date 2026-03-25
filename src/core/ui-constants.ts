// Shared UI constants — single source of truth for report-html (Node) and app/shared (browser)

import type { Category } from "./contracts/category.js";
import type { Severity } from "./contracts/severity.js";

// Re-export category/severity constants that already exist
export { CATEGORIES, CATEGORY_LABELS } from "./contracts/category.js";
export { SEVERITY_LABELS } from "./contracts/severity.js";

// Gauge geometry
export const GAUGE_R = 54;
export const GAUGE_C = Math.round(2 * Math.PI * GAUGE_R); // ~339

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  structure:
    "Auto Layout, responsive constraints, nesting depth, positioning, structure clarity",
  token: "Design token binding for colors, fonts, shadows, spacing grid",
  component:
    "Component reuse, detached instances, variant coverage and structure",
  naming: "Semantic layer names, naming conventions, default names",
  behavior:
    "Overflow handling, text truncation, wrap behavior, dynamic interactions",
};

export const SEVERITY_ORDER: Severity[] = [
  "blocking",
  "risk",
  "missing-info",
  "suggestion",
];
