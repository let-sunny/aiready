import type { RuleCheckFn, RuleDefinition } from "../../contracts/rule.js";
import type { AnalysisNode } from "../../contracts/figma-node.js";
import { defineRule } from "../rule-registry.js";
import { getRuleOption } from "../rule-config.js";

// ============================================
// Helper functions
// ============================================

function hasStyleReference(node: AnalysisNode, styleType: string): boolean {
  return node.styles !== undefined && styleType in node.styles;
}

function hasBoundVariable(node: AnalysisNode, key: string): boolean {
  return node.boundVariables !== undefined && key in node.boundVariables;
}

function isOnGrid(value: number, gridBase: number): boolean {
  return value % gridBase === 0;
}

// ============================================
// raw-value (merged: raw-color + raw-font + raw-shadow + raw-opacity)
// ============================================

const rawValueDef: RuleDefinition = {
  id: "raw-value",
  name: "Raw Value",
  category: "token-management",
  why: "Values without design tokens or variables must be reproduced exactly per node — one typo means a visible difference",
  impact: "AI cannot reference a shared token, so each raw value is an independent source of error across large pages",
  fix: "Use design tokens or variables (color styles, text styles, effect styles, opacity/spacing variables) so values are referenceable",
};

const rawValueCheck: RuleCheckFn = (node, context) => {
  // Check 1: Raw fill color
  if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
    if (!hasStyleReference(node, "fill") && !hasBoundVariable(node, "fills")) {
      for (const fill of node.fills) {
        const fillObj = fill as Record<string, unknown>;
        if (fillObj["type"] === "SOLID" && fillObj["color"]) {
          const c = fillObj["color"] as Record<string, number>;
          const hex = `#${Math.round((c["r"] ?? 0) * 255).toString(16).padStart(2, "0")}${Math.round((c["g"] ?? 0) * 255).toString(16).padStart(2, "0")}${Math.round((c["b"] ?? 0) * 255).toString(16).padStart(2, "0")}`.toUpperCase();
          return {
            ruleId: rawValueDef.id,
            nodeId: node.id,
            nodePath: context.path.join(" > "),
            message: `"${node.name}" uses raw fill color ${hex} without style or variable — bind to a color token`,
          };
        }
      }
    }
  }

  // Check 2: Raw font (TEXT nodes without text style)
  if (node.type === "TEXT") {
    if (
      !hasStyleReference(node, "text") &&
      (!hasBoundVariable(node, "fontFamily") || !hasBoundVariable(node, "fontSize"))
    ) {
      const fontParts: string[] = [];
      const s = node.style;
      if (s) {
        if (s["fontFamily"]) fontParts.push(String(s["fontFamily"]));
        if (s["fontSize"]) fontParts.push(`${s["fontSize"]}px`);
        if (s["fontWeight"]) fontParts.push(String(s["fontWeight"]));
      }
      const fontDesc = fontParts.length > 0 ? ` (${fontParts.join(" ")})` : "";
      return {
        ruleId: rawValueDef.id,
        nodeId: node.id,
        nodePath: context.path.join(" > "),
        message: `"${node.name}" uses raw font${fontDesc} without text style — apply a text style`,
      };
    }
  }

  // Check 3: Raw shadow (effects without effect style)
  if (node.effects && Array.isArray(node.effects) && node.effects.length > 0) {
    if (!hasStyleReference(node, "effect")) {
      for (const effect of node.effects) {
        const effectObj = effect as Record<string, unknown>;
        if (effectObj["type"] === "DROP_SHADOW" || effectObj["type"] === "INNER_SHADOW") {
          const shadowType = effectObj["type"] === "DROP_SHADOW" ? "drop shadow" : "inner shadow";
          const offset = effectObj["offset"] as Record<string, number> | undefined;
          const radius = effectObj["radius"] as number | undefined;
          const detailParts: string[] = [];
          if (offset) detailParts.push(`offset ${Math.round(offset["x"] ?? 0)},${Math.round(offset["y"] ?? 0)}`);
          if (radius !== undefined) detailParts.push(`blur ${Math.round(radius)}`);
          const details = detailParts.length > 0 ? ` (${detailParts.join(" ")})` : "";
          return {
            ruleId: rawValueDef.id,
            nodeId: node.id,
            nodePath: context.path.join(" > "),
            message: `"${node.name}" has ${shadowType}${details} without effect style — apply an effect style`,
          };
        }
      }
    }
  }

  // Check 4: Raw opacity (non-default opacity without variable)
  if (node.opacity !== undefined && !hasBoundVariable(node, "opacity")) {
    return {
      ruleId: rawValueDef.id,
      nodeId: node.id,
      nodePath: context.path.join(" > "),
      message: `"${node.name}" uses raw opacity (${Math.round(node.opacity * 100)}%) without a variable binding — bind opacity to a variable`,
    };
  }

  // Check 5: Raw spacing (padding/gap without variable binding)
  const spacingKeys = ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "itemSpacing"] as const;
  for (const key of spacingKeys) {
    const value = node[key];
    if (value !== undefined && value > 0 && !hasBoundVariable(node, key)) {
      const label = key === "itemSpacing" ? "gap" : key.replace("padding", "padding-").toLowerCase();
      return {
        ruleId: rawValueDef.id,
        nodeId: node.id,
        nodePath: context.path.join(" > "),
        message: `"${node.name}" uses raw ${label} (${value}px) without a variable binding — bind spacing to a variable`,
      };
    }
  }

  return null;
};

export const rawValue = defineRule({
  definition: rawValueDef,
  check: rawValueCheck,
});

// ============================================
// irregular-spacing (merged: inconsistent-spacing + magic-number-spacing)
// ============================================

const irregularSpacingDef: RuleDefinition = {
  id: "irregular-spacing",
  name: "Irregular Spacing",
  category: "token-management",
  why: "Off-grid or arbitrary spacing values force AI to handle many unique values instead of a predictable pattern",
  impact: "Higher chance of pixel-level differences when AI substitutes nearby round values",
  fix: "Align spacing to the design system grid (e.g., 4pt/8pt increments) for predictable implementation",
};

const irregularSpacingCheck: RuleCheckFn = (node, context, options) => {
  const configuredGridBase = (options?.["gridBase"] as number) ?? getRuleOption("irregular-spacing", "gridBase", 4);
  const gridBase = Number.isFinite(configuredGridBase) && configuredGridBase > 0 ? configuredGridBase : 4;

  const allSpacings = [
    node.paddingLeft,
    node.paddingRight,
    node.paddingTop,
    node.paddingBottom,
    node.itemSpacing,
  ].filter((s): s is number => s !== undefined && s > 0);

  // Allow small intentional values
  const commonValues = [1, 2];

  for (const spacing of allSpacings) {
    if (commonValues.includes(spacing)) continue;
    if (!isOnGrid(spacing, gridBase)) {
      return {
        ruleId: irregularSpacingDef.id,
        nodeId: node.id,
        nodePath: context.path.join(" > "),
        message: `"${node.name}" has spacing ${spacing}px not on ${gridBase}pt grid — round to nearest ${gridBase}pt multiple (${Math.round(spacing / gridBase) * gridBase}px)`,
      };
    }
  }

  return null;
};

export const irregularSpacing = defineRule({
  definition: irregularSpacingDef,
  check: irregularSpacingCheck,
});
