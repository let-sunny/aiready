import type { RuleCheckFn, RuleDefinition } from "../../contracts/rule.js";
import type { AnalysisNode } from "../../contracts/figma-node.js";
import { defineRule } from "../rule-registry.js";
import { getRuleOption } from "../rule-config.js";
import { isAutoLayoutExempt, isAbsolutePositionExempt, isSizeConstraintExempt, isFixedSizeExempt } from "../rule-exceptions.js";
import { noAutoLayoutMsg, absolutePositionMsg, fixedSizeMsg, missingSizeConstraintMsg, groupUsageMsg, deepNestingMsg } from "../rule-messages.js";

// ============================================
// Helper functions
// ============================================

function isContainerNode(node: AnalysisNode): boolean {
  return node.type === "FRAME" || node.type === "GROUP" || node.type === "COMPONENT" || node.type === "INSTANCE";
}

function hasAutoLayout(node: AnalysisNode): boolean {
  return node.layoutMode !== undefined && node.layoutMode !== "NONE";
}

function hasTextContent(node: AnalysisNode): boolean {
  return node.type === "TEXT" || (node.children?.some((c) => c.type === "TEXT") ?? false);
}

function hasOverlappingBounds(a: AnalysisNode, b: AnalysisNode): boolean {
  const boxA = a.absoluteBoundingBox;
  const boxB = b.absoluteBoundingBox;

  if (!boxA || !boxB) return false;

  return !(
    boxA.x + boxA.width <= boxB.x ||
    boxB.x + boxB.width <= boxA.x ||
    boxA.y + boxA.height <= boxB.y ||
    boxB.y + boxB.height <= boxA.y
  );
}

// ============================================
// no-auto-layout (merged: absorbs ambiguous-structure + missing-layout-hint)
// ============================================

const noAutoLayoutDef: RuleDefinition = {
  id: "no-auto-layout",
  name: "No Auto Layout",
  category: "pixel-critical",
  why: "Without Auto Layout, AI must guess positioning from absolute coordinates instead of reading explicit layout rules",
  impact: "Generated code uses hardcoded positions that break on any content or screen size change",
  fix: "Apply Auto Layout to create clear, explicit structure — enables AI to generate flexbox/grid instead of absolute positioning",
};

const noAutoLayoutCheck: RuleCheckFn = (node, context) => {
  if (!isContainerNode(node)) return null;
  if (hasAutoLayout(node)) return null;
  if (!node.children || node.children.length === 0) return null;

  if (isAutoLayoutExempt(node)) return null;

  // Priority 1: Check for overlapping visible children (ambiguous-structure)
  if (node.children.length >= 2) {
    for (let i = 0; i < node.children.length; i++) {
      for (let j = i + 1; j < node.children.length; j++) {
        const childA = node.children[i];
        const childB = node.children[j];
        if (!childA || !childB) continue;

        if (hasOverlappingBounds(childA, childB)) {
          if (childA.visible !== false && childB.visible !== false) {
            return {
              ruleId: noAutoLayoutDef.id,
              subType: "overlapping" as const,
              nodeId: node.id,
              nodePath: context.path.join(" > "),
              message: noAutoLayoutMsg.overlapping(node.name),
            };
          }
        }
      }
    }
  }

  // Priority 2: Check for nested containers without layout hints (missing-layout-hint)
  if (node.children.length >= 2) {
    const nestedContainers = node.children.filter((c) => isContainerNode(c));
    if (nestedContainers.length >= 2) {
      const withoutLayout = nestedContainers.filter((c) => !hasAutoLayout(c));
      if (withoutLayout.length >= 2) {
        return {
          ruleId: noAutoLayoutDef.id,
          subType: "nested" as const,
          nodeId: node.id,
          nodePath: context.path.join(" > "),
          message: noAutoLayoutMsg.nested(node.name),
        };
      }
    }
  }

  // Priority 3: Basic no-auto-layout check (FRAME only)
  if (node.type !== "FRAME") return null;

  const childCount = node.children?.length ?? 0;
  let directionHint = "";
  if (node.children && node.children.length >= 2) {
    const boxes = node.children.filter(c => c.absoluteBoundingBox).map(c => c.absoluteBoundingBox!);
    if (boxes.length >= 2) {
      const yRange = Math.max(...boxes.map(b => b.y)) - Math.min(...boxes.map(b => b.y));
      const xRange = Math.max(...boxes.map(b => b.x)) - Math.min(...boxes.map(b => b.x));
      directionHint = yRange > xRange ? "VERTICAL" : "HORIZONTAL";
    }
  }

  const arrangement = directionHint
    ? ` (${childCount} children arranged ${directionHint.toLowerCase()}ly)`
    : childCount > 0 ? ` (${childCount} children)` : "";

  return {
    ruleId: noAutoLayoutDef.id,
    subType: "basic" as const,
    nodeId: node.id,
    nodePath: context.path.join(" > "),
    message: noAutoLayoutMsg.basic(node.name, arrangement, directionHint),
  };
};

export const noAutoLayout = defineRule({
  definition: noAutoLayoutDef,
  check: noAutoLayoutCheck,
});

// ============================================
// absolute-position-in-auto-layout
// ============================================

const absolutePositionInAutoLayoutDef: RuleDefinition = {
  id: "absolute-position-in-auto-layout",
  name: "Absolute Position in Auto Layout",
  category: "pixel-critical",
  why: "Absolute positioning inside Auto Layout contradicts the parent's layout rules — AI sees conflicting instructions",
  impact: "AI must decide whether to follow the parent's flexbox or the child's absolute position — often gets it wrong",
  fix: "Remove absolute positioning or use proper Auto Layout alignment",
};

const absolutePositionInAutoLayoutCheck: RuleCheckFn = (node, context) => {
  if (!context.parent) return null;
  if (!hasAutoLayout(context.parent)) return null;
  if (node.layoutPositioning !== "ABSOLUTE") return null;

  if (isAbsolutePositionExempt(node)) return null;

  return {
    ruleId: absolutePositionInAutoLayoutDef.id,
    nodeId: node.id,
    nodePath: context.path.join(" > "),
    message: absolutePositionMsg(node.name, context.parent.name),
  };
};

export const absolutePositionInAutoLayout = defineRule({
  definition: absolutePositionInAutoLayoutDef,
  check: absolutePositionInAutoLayoutCheck,
});

// ============================================
// fixed-size-in-auto-layout (merged: absorbs fixed-width-in-responsive-context)
// ============================================

const fixedSizeInAutoLayoutDef: RuleDefinition = {
  id: "fixed-size-in-auto-layout",
  name: "Fixed Size in Auto Layout",
  category: "responsive-critical",
  why: "Fixed sizing inside Auto Layout contradicts the flexible layout intent",
  impact: "AI generates a rigid element inside a flex container — the layout won't respond to content changes",
  fix: "Use 'Hug' or 'Fill' for at least one axis. Both-axes FIXED → layout completely rigid; horizontal-only FIXED → width won't adapt to parent resize",
};

const fixedSizeInAutoLayoutCheck: RuleCheckFn = (node, context) => {
  if (!context.parent) return null;
  if (!hasAutoLayout(context.parent)) return null;
  if (!isContainerNode(node)) return null;
  if (!node.absoluteBoundingBox) return null;

  if (isFixedSizeExempt(node)) return null;

  const { width, height } = node.absoluteBoundingBox;

  // Check both axes FIXED (stronger case)
  const hFixed =
    node.layoutSizingHorizontal === "FIXED" || node.layoutSizingHorizontal === undefined;
  const vFixed =
    node.layoutSizingVertical === "FIXED" || node.layoutSizingVertical === undefined;

  if (hFixed && vFixed) {
    // Skip if it has its own auto-layout
    if (node.layoutMode && node.layoutMode !== "NONE") return null;

    return {
      ruleId: fixedSizeInAutoLayoutDef.id,
      subType: "both-axes" as const,
      nodeId: node.id,
      nodePath: context.path.join(" > "),
      message: fixedSizeMsg.bothAxes(node.name, width, height),
    };
  }

  // Check horizontal-only FIXED (lighter case, from fixed-width-in-responsive-context)
  if (hFixed && !vFixed) {
    // Use layoutSizingHorizontal if available (accurate)
    if (node.layoutSizingHorizontal) {
      if (node.layoutSizingHorizontal !== "FIXED") return null;
    } else {
      // Fallback: STRETCH means fill, skip
      if (node.layoutAlign === "STRETCH") return null;
      if (node.layoutAlign !== "INHERIT") return null;
    }

    return {
      ruleId: fixedSizeInAutoLayoutDef.id,
      subType: "horizontal" as const,
      nodeId: node.id,
      nodePath: context.path.join(" > "),
      message: fixedSizeMsg.horizontal(node.name, width),
    };
  }

  return null;
};

export const fixedSizeInAutoLayout = defineRule({
  definition: fixedSizeInAutoLayoutDef,
  check: fixedSizeInAutoLayoutCheck,
});

// ============================================
// missing-size-constraint (merged: missing-min-width + missing-max-width)
// ============================================

const missingSizeConstraintDef: RuleDefinition = {
  id: "missing-size-constraint",
  name: "Missing Size Constraint",
  category: "responsive-critical",
  why: "Without min/max-width, AI has no bounds — generated code may collapse or stretch indefinitely",
  impact: "Content becomes unreadable or invisible at extreme screen sizes",
  fix: "Set min-width and/or max-width so AI can generate proper size constraints",
};

const missingSizeConstraintCheck: RuleCheckFn = (node, context) => {
  // Only check containers and text-containing nodes
  if (!isContainerNode(node) && !hasTextContent(node)) return null;
  // Skip if not in Auto Layout context
  if (!context.parent || !hasAutoLayout(context.parent)) return null;
  // Only flag FILL containers — FIXED/HUG don't need min/max-width
  if (node.layoutSizingHorizontal !== "FILL") return null;

  if (isSizeConstraintExempt(node, context)) return null;

  const currentWidth = node.absoluteBoundingBox ? `${node.absoluteBoundingBox.width}px` : "unknown";

  return {
    ruleId: missingSizeConstraintDef.id,
    nodeId: node.id,
    nodePath: context.path.join(" > "),
    message: missingSizeConstraintMsg(node.name, currentWidth),
  };
};

export const missingSizeConstraint = defineRule({
  definition: missingSizeConstraintDef,
  check: missingSizeConstraintCheck,
});

// ============================================
// group-usage
// ============================================

const groupUsageDef: RuleDefinition = {
  id: "group-usage",
  name: "Group Usage",
  category: "pixel-critical",
  why: "Groups have no layout rules — AI sees children with absolute coordinates but no container logic",
  impact: "AI wraps grouped elements in a plain div with no spacing/alignment, producing fragile layouts",
  fix: "Convert Group to Frame with Auto Layout so AI can generate proper flex/grid containers",
};

const groupUsageCheck: RuleCheckFn = (node, context) => {
  if (node.type !== "GROUP") return null;

  return {
    ruleId: groupUsageDef.id,
    nodeId: node.id,
    nodePath: context.path.join(" > "),
    message: groupUsageMsg(node.name),
  };
};

export const groupUsage = defineRule({
  definition: groupUsageDef,
  check: groupUsageCheck,
});

// ============================================
// deep-nesting
// ============================================

const deepNestingDef: RuleDefinition = {
  id: "deep-nesting",
  name: "Deep Nesting",
  category: "code-quality",
  why: "Deep nesting consumes AI context exponentially — each level adds indentation and structural overhead",
  impact: "AI may lose track of parent-child relationships in deeply nested trees, producing wrong layout hierarchy",
  fix: "Flatten the structure by extracting deeply nested groups into sub-components",
};

const deepNestingCheck: RuleCheckFn = (node, context, options) => {
  const maxDepth = (options?.["maxDepth"] as number) ?? getRuleOption("deep-nesting", "maxDepth", 5);

  if (context.componentDepth < maxDepth) return null;
  if (!isContainerNode(node)) return null;

  return {
    ruleId: deepNestingDef.id,
    nodeId: node.id,
    nodePath: context.path.join(" > "),
    message: deepNestingMsg(node.name, context.componentDepth, maxDepth),
  };
};

export const deepNesting = defineRule({
  definition: deepNestingDef,
  check: deepNestingCheck,
});

