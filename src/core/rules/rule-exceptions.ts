import type { AnalysisNode } from "../contracts/figma-node.js";
import type { RuleContext } from "../contracts/rule.js";
import { isVisualLeafType, isVisualOnlyNode, isExcludedName } from "./node-semantics.js";

// ============================================
// Auto-layout exceptions
// ============================================

/** Frames that don't need auto-layout (only visual-leaf children like icon paths) */
export function isAutoLayoutExempt(node: AnalysisNode): boolean {
  if (
    node.children &&
    node.children.length > 0 &&
    node.children.every((c) => isVisualLeafType(c.type))
  ) return true;

  return false;
}

// ============================================
// Absolute-position exceptions
// ============================================

/** Nodes that are allowed to use absolute positioning inside auto-layout */
export function isAbsolutePositionExempt(node: AnalysisNode): boolean {
  if (isVisualOnlyNode(node)) return true;

  // Intentional name patterns (badge, close, overlay, etc.)
  if (isExcludedName(node.name)) return true;

  return false;
}

// ============================================
// Size-constraint exceptions
// ============================================

/** Nodes that don't need maxWidth even with FILL sizing */
export function isSizeConstraintExempt(node: AnalysisNode, context: RuleContext): boolean {
  // Already has maxWidth
  if (node.maxWidth !== undefined) return true;

  // Parent already has maxWidth — parent constrains the stretch
  if (context.parent?.maxWidth !== undefined) return true;

  // Root-level frames — they represent the screen itself
  if (context.depth <= 1) return true;

  return false;
}

// ============================================
// Fixed-size exceptions
// ============================================

/** Nodes that are allowed to use fixed sizing inside auto-layout */
export function isFixedSizeExempt(node: AnalysisNode): boolean {
  // Visual-only nodes (icons, images, shapes) — intentionally fixed
  if (isVisualOnlyNode(node)) return true;

  // Excluded names (nav, header, etc.)
  if (isExcludedName(node.name)) return true;

  return false;
}
