import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { fixedWidthInResponsiveContext } from "./index.js";

function makeNode(overrides?: Partial<AnalysisNode>): AnalysisNode {
  return { id: "1:1", name: "TestNode", type: "FRAME", visible: true, ...overrides };
}

function makeFile(): AnalysisFile {
  return {
    fileKey: "test-file",
    name: "Test File",
    lastModified: "2026-01-01T00:00:00Z",
    version: "1",
    document: makeNode({ id: "0:1", name: "Document", type: "DOCUMENT" }),
    components: {},
    styles: {},
  };
}

function makeContext(overrides?: Partial<RuleContext>): RuleContext {
  return {
    file: makeFile(),
    depth: 2,
    componentDepth: 0,
    maxDepth: 10,
    path: ["Page", "Section"],
    analysisState: new Map(),
    ...overrides,
  };
}

describe("fixed-width-in-responsive-context", () => {
  it("has correct rule definition metadata", () => {
    expect(fixedWidthInResponsiveContext.definition.id).toBe("fixed-width-in-responsive-context");
    expect(fixedWidthInResponsiveContext.definition.category).toBe("layout");
  });

  it("flags container with FIXED horizontal sizing in auto layout parent", () => {
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    const node = makeNode({ type: "FRAME", name: "LeftPanel", layoutSizingHorizontal: "FIXED" });
    const result = fixedWidthInResponsiveContext.check(node, makeContext({ parent }));
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("fixed-width-in-responsive-context");
  });

  it("returns null when no parent", () => {
    const node = makeNode({ type: "FRAME", layoutSizingHorizontal: "FIXED" });
    expect(fixedWidthInResponsiveContext.check(node, makeContext())).toBeNull();
  });

  it("returns null when parent has no auto layout", () => {
    const parent = makeNode({});
    const node = makeNode({ type: "FRAME", layoutSizingHorizontal: "FIXED" });
    expect(fixedWidthInResponsiveContext.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null for non-container nodes", () => {
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    const node = makeNode({ type: "TEXT", layoutSizingHorizontal: "FIXED" });
    expect(fixedWidthInResponsiveContext.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null when sizing is FILL", () => {
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    const node = makeNode({ type: "FRAME", layoutSizingHorizontal: "FILL" });
    expect(fixedWidthInResponsiveContext.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null when sizing is HUG", () => {
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    const node = makeNode({ type: "FRAME", layoutSizingHorizontal: "HUG" });
    expect(fixedWidthInResponsiveContext.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null for excluded name patterns", () => {
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    const node = makeNode({ type: "FRAME", name: "navigation", layoutSizingHorizontal: "FIXED" });
    expect(fixedWidthInResponsiveContext.check(node, makeContext({ parent }))).toBeNull();
  });

  it("fallback: returns null when layoutAlign is STRETCH (no layoutSizingHorizontal)", () => {
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    const node = makeNode({ type: "FRAME", layoutAlign: "STRETCH" });
    expect(fixedWidthInResponsiveContext.check(node, makeContext({ parent }))).toBeNull();
  });
});
