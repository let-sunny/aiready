import type { RuleCheckFn, RuleDefinition } from "../../contracts/rule.js";
import type { AnalysisNode } from "../../contracts/figma-node.js";
import { defineRule } from "../rule-registry.js";
import { getRuleOption } from "../rule-config.js";
import { rawValueMsg, irregularSpacingMsg } from "../rule-messages.js";

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
// raw-value (merged: raw-color + raw-font + raw-shadow + raw-opacity + raw-spacing)
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
  const nodePath = context.path.join(" > ");

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
            subType: "color" as const,
            nodeId: node.id,
            nodePath,
            message: rawValueMsg.color(node.name, hex),
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
        subType: "font" as const,
        nodeId: node.id,
        nodePath,
        message: rawValueMsg.font(node.name, fontDesc),
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
            subType: "shadow" as const,
            nodeId: node.id,
            nodePath,
            message: rawValueMsg.shadow(node.name, shadowType, details),
          };
        }
      }
    }
  }

  // Check 4: Raw opacity (non-default opacity without variable)
  if (node.opacity !== undefined && !hasBoundVariable(node, "opacity")) {
    return {
      ruleId: rawValueDef.id,
      subType: "opacity" as const,
      nodeId: node.id,
      nodePath,
      message: rawValueMsg.opacity(node.name, Math.round(node.opacity * 100)),
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
        subType: "spacing" as const,
        nodeId: node.id,
        nodePath,
        message: rawValueMsg.spacing(node.name, label, value),
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

  const spacingEntries: Array<{ value: number; subType: "padding" | "gap" }> = [];
  for (const key of ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom"] as const) {
    const v = node[key];
    if (v !== undefined && v > 0) spacingEntries.push({ value: v, subType: "padding" });
  }
  if (node.itemSpacing !== undefined && node.itemSpacing > 0) {
    spacingEntries.push({ value: node.itemSpacing, subType: "gap" });
  }

  // Allow small intentional values
  const commonValues = [1, 2];

  for (const entry of spacingEntries) {
    if (commonValues.includes(entry.value)) continue;
    if (!isOnGrid(entry.value, gridBase)) {
      return {
        ruleId: irregularSpacingDef.id,
        subType: entry.subType,
        nodeId: node.id,
        nodePath: context.path.join(" > "),
        message: irregularSpacingMsg(node.name, entry.value, gridBase, Math.round(entry.value / gridBase) * gridBase),
      };
    }
  }

  return null;
};

export const irregularSpacing = defineRule({
  definition: irregularSpacingDef,
  check: irregularSpacingCheck,
});
