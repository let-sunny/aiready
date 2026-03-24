import type { RuleCheckFn, RuleDefinition } from "../../contracts/rule.js";
import type { AnalysisNode } from "../../contracts/figma-node.js";
import { defineRule } from "../rule-registry.js";
import { getRuleOption } from "../rule-config.js";

// ============================================
// Helper functions
// ============================================

function isComponentInstance(node: AnalysisNode): boolean {
  return node.type === "INSTANCE";
}

function isComponent(node: AnalysisNode): boolean {
  return node.type === "COMPONENT" || node.type === "COMPONENT_SET";
}

/**
 * Collect all frame names in the file for duplicate detection
 */
function collectFrameNames(
  node: AnalysisNode,
  names: Map<string, string[]> = new Map()
): Map<string, string[]> {
  if (node.type === "FRAME" && node.name) {
    const existing = names.get(node.name) ?? [];
    existing.push(node.id);
    names.set(node.name, existing);
  }

  if (node.children) {
    for (const child of node.children) {
      collectFrameNames(child, names);
    }
  }

  return names;
}

// ============================================
// missing-component
// ============================================

const missingComponentDef: RuleDefinition = {
  id: "missing-component",
  name: "Missing Component",
  category: "component",
  why: "Repeated identical structures should be componentized",
  impact: "Changes require manual updates in multiple places",
  fix: "Create a component from the repeated structure",
};

const missingComponentCheck: RuleCheckFn = (node, context, options) => {
  // Only check at frame level
  if (node.type !== "FRAME") return null;

  const minRepetitions = (options?.["minRepetitions"] as number) ??
    getRuleOption("missing-component", "minRepetitions", 3);

  // Collect frame names in the file (cached per analysis run would be better)
  const frameNames = collectFrameNames(context.file.document);
  const sameNameFrames = frameNames.get(node.name);

  if (sameNameFrames && sameNameFrames.length >= minRepetitions) {
    // Only report on the first occurrence to avoid duplicate issues
    if (sameNameFrames[0] === node.id) {
      return {
        ruleId: missingComponentDef.id,
        nodeId: node.id,
        nodePath: context.path.join(" > "),
        message: `"${node.name}" appears ${sameNameFrames.length} times - consider making it a component`,
      };
    }
  }

  return null;
};

export const missingComponent = defineRule({
  definition: missingComponentDef,
  check: missingComponentCheck,
});

// ============================================
// detached-instance
// ============================================

const detachedInstanceDef: RuleDefinition = {
  id: "detached-instance",
  name: "Detached Instance",
  category: "component",
  why: "Detached instances lose their connection to the source component",
  impact: "Updates to the component won't propagate to this instance",
  fix: "Reset the instance or create a new variant if customization is needed",
};

const detachedInstanceCheck: RuleCheckFn = (node, context) => {
  // A detached instance would be a FRAME that was once an INSTANCE
  // This is hard to detect without historical data
  // Heuristic: Frame with a name that looks like it came from a component
  if (node.type !== "FRAME") return null;

  // Check if there's a component in the file with a similar name
  const components = context.file.components;
  const nodeName = node.name.toLowerCase();

  for (const [, component] of Object.entries(components)) {
    if (nodeName.includes(component.name.toLowerCase())) {
      // This frame might be a detached instance of this component
      return {
        ruleId: detachedInstanceDef.id,
        nodeId: node.id,
        nodePath: context.path.join(" > "),
        message: `"${node.name}" may be a detached instance of component "${component.name}"`,
      };
    }
  }

  return null;
};

export const detachedInstance = defineRule({
  definition: detachedInstanceDef,
  check: detachedInstanceCheck,
});

// ============================================
// nested-instance-override
// ============================================

const nestedInstanceOverrideDef: RuleDefinition = {
  id: "nested-instance-override",
  name: "Nested Instance Override",
  category: "component",
  why: "Excessive overrides in instances make components harder to maintain",
  impact: "Component updates may not work as expected",
  fix: "Create a variant or new component for significantly different use cases",
};

const nestedInstanceOverrideCheck: RuleCheckFn = (node, context) => {
  if (!isComponentInstance(node)) return null;

  // Check for component property overrides
  if (!node.componentProperties) return null;

  const overrideCount = Object.keys(node.componentProperties).length;

  // Flag if there are too many overrides
  if (overrideCount > 5) {
    return {
      ruleId: nestedInstanceOverrideDef.id,
      nodeId: node.id,
      nodePath: context.path.join(" > "),
      message: `"${node.name}" has ${overrideCount} property overrides - consider creating a variant`,
    };
  }

  return null;
};

export const nestedInstanceOverride = defineRule({
  definition: nestedInstanceOverrideDef,
  check: nestedInstanceOverrideCheck,
});

// ============================================
// variant-not-used
// ============================================

const variantNotUsedDef: RuleDefinition = {
  id: "variant-not-used",
  name: "Variant Not Used",
  category: "component",
  why: "Using instances but not leveraging variants defeats their purpose",
  impact: "Manual changes instead of using designed variants",
  fix: "Use the appropriate variant instead of overriding the default",
};

const variantNotUsedCheck: RuleCheckFn = (_node, _context) => {
  // This would require checking if an instance is using default variant
  // when other variants exist that better match the current state
  // Needs more context from component definitions
  return null;
};

export const variantNotUsed = defineRule({
  definition: variantNotUsedDef,
  check: variantNotUsedCheck,
});

// ============================================
// component-property-unused
// ============================================

const componentPropertyUnusedDef: RuleDefinition = {
  id: "component-property-unused",
  name: "Component Property Unused",
  category: "component",
  why: "Component properties should be utilized to expose customization",
  impact: "Hardcoded values that should be configurable",
  fix: "Connect the value to a component property",
};

const componentPropertyUnusedCheck: RuleCheckFn = (node, _context) => {
  if (!isComponent(node)) return null;

  // Check if component has property definitions but children don't use them
  if (!node.componentPropertyDefinitions) return null;

  const definedProps = Object.keys(node.componentPropertyDefinitions);
  if (definedProps.length === 0) return null;

  // This would require checking if properties are actually bound
  // Simplified for now
  return null;
};

export const componentPropertyUnused = defineRule({
  definition: componentPropertyUnusedDef,
  check: componentPropertyUnusedCheck,
});

// ============================================
// single-use-component
// ============================================

const singleUseComponentDef: RuleDefinition = {
  id: "single-use-component",
  name: "Single Use Component",
  category: "component",
  why: "Components used only once add complexity without reuse benefit",
  impact: "Unnecessary abstraction increases maintenance overhead",
  fix: "Consider inlining if this component won't be reused",
};

const singleUseComponentCheck: RuleCheckFn = (node, context) => {
  if (!isComponent(node)) return null;

  // Count instances of this component in the file
  let instanceCount = 0;

  function countInstances(n: AnalysisNode): void {
    if (n.type === "INSTANCE" && n.componentId === node.id) {
      instanceCount++;
    }
    if (n.children) {
      for (const child of n.children) {
        countInstances(child);
      }
    }
  }

  countInstances(context.file.document);

  if (instanceCount === 1) {
    return {
      ruleId: singleUseComponentDef.id,
      nodeId: node.id,
      nodePath: context.path.join(" > "),
      message: `Component "${node.name}" is only used once`,
    };
  }

  return null;
};

export const singleUseComponent = defineRule({
  definition: singleUseComponentDef,
  check: singleUseComponentCheck,
});

// ============================================
// missing-component-description
// ============================================

/**
 * Module-level Set for deduplication across nodes within a single analysis run.
 * Tracks componentIds that have already been flagged to avoid duplicate issues
 * when many INSTANCE nodes reference the same component.
 *
 * Note: This Set persists for the lifetime of the module (i.e., the process).
 * The analysis engine is expected to clear it between runs if needed, but since
 * each CLI invocation starts a fresh process this is safe in practice.
 */
const seenMissingDescriptionComponentIds = new Set<string>();

const missingComponentDescriptionDef: RuleDefinition = {
  id: "missing-component-description",
  name: "Missing Component Description",
  category: "component",
  why: "Component descriptions in Figma are the primary channel for communicating intent, usage guidelines, and prop expectations to developers. Without them, developers must reverse-engineer purpose from visual appearance alone.",
  impact: "Increases implementation ambiguity, especially for icon-only components, compound components with multiple variants, and components whose names are variant key strings that give no prose context.",
  fix: "Open the component in Figma, select it, and add a description in the right-hand panel under the component's properties. Include: what the component is, when to use it, any accessibility or interaction notes, and the owning team or design token set if applicable.",
};

const missingComponentDescriptionCheck: RuleCheckFn = (node, context) => {
  if (node.type !== "INSTANCE") return null;

  const componentId = node.componentId;
  if (!componentId) return null;

  const componentMeta = context.file.components[componentId];
  if (!componentMeta) return null;

  if (componentMeta.description.trim() !== "") return null;

  // Deduplicate: emit at most one issue per unique componentId
  if (seenMissingDescriptionComponentIds.has(componentId)) return null;
  seenMissingDescriptionComponentIds.add(componentId);

  return {
    ruleId: missingComponentDescriptionDef.id,
    nodeId: node.id,
    nodePath: context.path.join(" > "),
    message: `Component "${componentMeta.name}" has no description. Descriptions help developers understand purpose and usage.`,
  };
};

export const missingComponentDescription = defineRule({
  definition: missingComponentDescriptionDef,
  check: missingComponentDescriptionCheck,
});

/**
 * Reset deduplication state between analysis runs.
 * Call this at the start of each analysis if the process is long-running
 * (e.g. MCP server mode).
 */
export function resetMissingComponentDescriptionState(): void {
  seenMissingDescriptionComponentIds.clear();
}

// ============================================
// repeated-frame-structure
// ============================================

/**
 * Build a structural fingerprint for a node.
 * The fingerprint encodes type, layoutMode, and child types recursively up to maxDepth.
 */
function buildFingerprint(node: AnalysisNode, depth: number): string {
  if (depth <= 0 || !node.children || node.children.length === 0) {
    return `${node.type}:${node.layoutMode ?? "NONE"}`;
  }

  const childFingerprints = node.children
    .map((child) => buildFingerprint(child, depth - 1))
    .join(",");

  return `${node.type}:${node.layoutMode ?? "NONE"}:[${childFingerprints}]`;
}

/**
 * Check if the node is inside an INSTANCE subtree.
 * Currently checks immediate parent only — RuleContext does not expose the full
 * ancestor type chain (context.path contains names, not types).
 * TODO: When the engine exposes ancestor types, extend to full chain check.
 */
function isInsideInstance(context: {
  parent?: AnalysisNode | undefined;
}): boolean {
  return context.parent?.type === "INSTANCE";
}

const repeatedFrameStructureDef: RuleDefinition = {
  id: "repeated-frame-structure",
  name: "Repeated Frame Structure",
  category: "component",
  why: "Sibling frames with identical internal structure are copy-paste patterns that should be componentized. On large pages, this inflates AI token consumption — each repeated frame is described independently instead of referencing a shared component definition.",
  impact: "AI code generators reproduce each frame independently, missing the opportunity to emit a reusable component. Maintenance cost scales linearly with repetition count.",
  fix: "Extract the repeated frame into a Figma component and replace each occurrence with an instance. If the repetition is intentional (e.g. fixed section layout), rename frames to reflect their distinct purpose.",
};

const repeatedFrameStructureCheck: RuleCheckFn = (node, context, options) => {
  // Only activate for FRAME nodes
  if (node.type !== "FRAME") return null;

  // Skip if node is inside an INSTANCE subtree
  if (isInsideInstance(context)) return null;

  // Skip if parent is COMPONENT_SET
  if (context.parent?.type === "COMPONENT_SET") return null;

  // Skip if node has no children
  if (!node.children || node.children.length === 0) return null;

  const minRepetitions =
    (options?.["minRepetitions"] as number | undefined) ??
    getRuleOption("repeated-frame-structure", "minRepetitions", 2);

  const maxFingerprintDepth =
    (options?.["maxFingerprintDepth"] as number | undefined) ??
    getRuleOption("repeated-frame-structure", "maxFingerprintDepth", 3);

  // Compute fingerprint for this node
  const fingerprint = buildFingerprint(node, maxFingerprintDepth);

  // Access siblings (may be undefined)
  const siblings = context.siblings ?? [];

  // Filter siblings to qualifying frames (type === FRAME, not inside INSTANCE, has children)
  const qualifyingSiblings = siblings.filter(
    (s) =>
      s.type === "FRAME" &&
      s.children !== undefined &&
      s.children.length > 0
  );

  // Count siblings (including self) sharing the same fingerprint
  const matchingNodes = qualifyingSiblings.filter(
    (s) => buildFingerprint(s, maxFingerprintDepth) === fingerprint
  );

  // Ensure self is counted (it should be in siblings, but add a guard)
  const selfIsInSiblings = qualifyingSiblings.some((s) => s.id === node.id);
  const count = selfIsInSiblings ? matchingNodes.length : matchingNodes.length + 1;

  if (count < minRepetitions) return null;

  // Only emit for the first sibling (by array order) with this fingerprint
  const firstMatch = qualifyingSiblings.find(
    (s) => buildFingerprint(s, maxFingerprintDepth) === fingerprint
  );

  // If self is not in siblings list, treat self as first match when no earlier match exists
  const firstMatchId = firstMatch?.id ?? node.id;
  if (firstMatchId !== node.id) return null;

  return {
    ruleId: repeatedFrameStructureDef.id,
    nodeId: node.id,
    nodePath: context.path.join(" > "),
    message: `"${node.name}" and ${count - 1} sibling frame(s) share the same internal structure — consider extracting a component`,
  };
};

export const repeatedFrameStructure = defineRule({
  definition: repeatedFrameStructureDef,
  check: repeatedFrameStructureCheck,
});
