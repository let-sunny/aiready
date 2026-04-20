import { z } from "zod";
import type { RuleId } from "../contracts/rule.js";

/**
 * Gotcha question template for a single rule.
 * Used to generate user-facing surveys from analysis results (#236).
 *
 * - question: uses {nodeName} placeholder for the affected node
 * - hint: guides the user on what kind of answer is expected
 * - example: concrete example answer
 */
export const GotchaQuestionSchema = z.object({
  ruleId: z.string(),
  detection: z.literal("rule-based"),
  outputChannel: z.literal("annotation"),
  persistenceIntent: z.literal("durable"),
  question: z.string(),
  hint: z.string(),
  example: z.string(),
});

export type GotchaQuestion = z.infer<typeof GotchaQuestionSchema>;

/**
 * Gotcha question mapping for all 16 rules.
 * Keyed by ruleId for O(1) lookup during survey generation.
 */
type GotchaQuestionContent = Omit<
  GotchaQuestion,
  "detection" | "outputChannel" | "persistenceIntent"
>;

const GOTCHA_QUESTION_CONTENT: Record<RuleId, GotchaQuestionContent> = {
  // ── Pixel Critical (blocking) ──

  "no-auto-layout": {
    ruleId: "no-auto-layout",
    question: 'Frame "{nodeName}" has no Auto Layout. How should this area be laid out?',
    hint: "Describe the flex direction, gap, and alignment",
    example: "Vertical flex, gap 16px, items centered",
  },
  "absolute-position-in-auto-layout": {
    ruleId: "absolute-position-in-auto-layout",
    question: '"{nodeName}" uses absolute positioning inside an Auto Layout parent. Is this an intentional overlay, or should it flow with the layout?',
    hint: "Specify if this is a badge/overlay, or should be part of the normal flow",
    example: "This is a notification badge — position absolute, top-right corner",
  },
  "non-layout-container": {
    ruleId: "non-layout-container",
    question: '"{nodeName}" is a Group/Section used as a layout container. What layout structure should it have?',
    hint: "Describe the intended layout: flex direction, wrap, gap",
    example: "Horizontal flex, gap 12px, wrap on mobile",
  },

  // ── Responsive Critical (risk) ──

  "fixed-size-in-auto-layout": {
    ruleId: "fixed-size-in-auto-layout",
    question: '"{nodeName}" has a fixed size inside Auto Layout. Should it be responsive?',
    hint: "Specify which axis should be flexible (width, height, or both)",
    example: "Width should FILL the parent, height can stay fixed",
  },
  "missing-size-constraint": {
    ruleId: "missing-size-constraint",
    question: '"{nodeName}" uses FILL sizing without min/max constraints. What are the size boundaries?',
    hint: "Provide min-width, max-width, or both",
    example: "min-width 320px, max-width 1200px",
  },

  // ── Code Quality (risk) ──

  "missing-component": {
    ruleId: "missing-component",
    question: '"{nodeName}" appears to be a repeated structure. Should it be a reusable component?',
    hint: "Describe if this should be extracted as a component and what props it needs",
    example: "Yes, extract as ProductCard component with title, image, and price props",
  },
  "detached-instance": {
    ruleId: "detached-instance",
    question: '"{nodeName}" looks like a detached component instance. Should it use the original component or is it a new variant?',
    hint: "Specify whether to restore the component link or create a new variant",
    example: "This is a new variant — create a 'compact' variant of the original component",
  },
  "variant-structure-mismatch": {
    ruleId: "variant-structure-mismatch",
    question: '"{nodeName}" has variants with different child structures. Which structure is the canonical one?',
    hint: "Describe which variant has the correct structure, or if they should all match",
    example: "Default variant is canonical — other variants should toggle child visibility instead of adding/removing elements",
  },
  "deep-nesting": {
    ruleId: "deep-nesting",
    question: '"{nodeName}" is deeply nested. Can some intermediate layers be flattened or extracted?',
    hint: "Identify which wrapper layers are unnecessary or should become sub-components",
    example: "The inner wrapper is just for spacing — flatten it and use padding instead",
  },

  // ── Token Management ──

  "raw-value": {
    ruleId: "raw-value",
    question: '"{nodeName}" uses raw values without design tokens. What tokens should be used?',
    hint: "Specify the token names or variable references for colors, fonts, spacing, etc.",
    example: "Use $color-primary for the fill, $font-body for the text style",
  },
  "irregular-spacing": {
    ruleId: "irregular-spacing",
    question: '"{nodeName}" has spacing values that are off the design grid. What should the correct spacing be?',
    hint: "Provide the intended spacing value aligned to the grid system",
    example: "Gap should be 16px (4pt grid), not 15px",
  },

  // ── Interaction ──

  "missing-interaction-state": {
    ruleId: "missing-interaction-state",
    question: '"{nodeName}" appears interactive but is missing state variants. What interaction states are needed?',
    hint: "List the needed states: Hover, Active, Disabled, Focus",
    example: "Needs Hover (darken 10%) and Disabled (opacity 50%, no pointer events)",
  },
  "missing-prototype": {
    ruleId: "missing-prototype",
    question: '"{nodeName}" looks interactive but has no prototype interaction. What should happen on click/interaction?',
    hint: "Describe the interaction behavior: navigation, overlay, state change, etc.",
    example: "On click, navigate to the product detail page",
  },

  // ── Semantic ──

  "non-standard-naming": {
    ruleId: "non-standard-naming",
    question: '"{nodeName}" uses non-standard state names. What naming convention should be followed?',
    hint: "Specify the expected state name format (e.g., Hover, Disabled, Active)",
    example: 'Use "Hover" instead of "hover_v1", "Disabled" instead of "off"',
  },
  "non-semantic-name": {
    ruleId: "non-semantic-name",
    question: '"{nodeName}" has a non-semantic name. What is the purpose of this element?',
    hint: "Provide a descriptive name that reflects the element's role in the UI",
    example: 'Rename "Frame 12" to "HeroSection" or "ProductGrid"',
  },
  "inconsistent-naming-convention": {
    ruleId: "inconsistent-naming-convention",
    question: '"{nodeName}" uses a different naming convention than its siblings. Which convention should be used?',
    hint: "Choose one: camelCase, kebab-case, PascalCase, or Title Case",
    example: "Use PascalCase for all component layers (e.g., CardTitle, CardBody)",
  },
};

const GOTCHA_DETECTION: GotchaQuestion["detection"] = "rule-based";
const GOTCHA_OUTPUT_CHANNEL: GotchaQuestion["outputChannel"] = "annotation";
const GOTCHA_PERSISTENCE_INTENT: GotchaQuestion["persistenceIntent"] = "durable";

/**
 * #402: Keep 1:1 rule-keying for generation, but make the gotcha channel
 * semantics explicit in the registry itself.
 */
export const GOTCHA_QUESTIONS: Record<RuleId, GotchaQuestion> = Object.fromEntries(
  Object.entries(GOTCHA_QUESTION_CONTENT).map(([ruleId, content]) => [
    ruleId,
    {
      ...content,
      detection: GOTCHA_DETECTION,
      outputChannel: GOTCHA_OUTPUT_CHANNEL,
      persistenceIntent: GOTCHA_PERSISTENCE_INTENT,
    },
  ]),
) as Record<RuleId, GotchaQuestion>;

/**
 * Get the gotcha question for a specific rule.
 */
export function getGotchaQuestion(ruleId: RuleId): GotchaQuestion {
  return GOTCHA_QUESTIONS[ruleId];
}

/**
 * Format a gotcha question by replacing the {nodeName} placeholder.
 */
export function formatGotchaQuestion(ruleId: RuleId, nodeName: string): string {
  return GOTCHA_QUESTIONS[ruleId].question.replace("{nodeName}", nodeName);
}
