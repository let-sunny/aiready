import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { missingResponsiveBehavior } from "./index.js";

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

describe("missing-responsive-behavior", () => {
  it("has correct rule definition metadata", () => {
    expect(missingResponsiveBehavior.definition.id).toBe("missing-responsive-behavior");
    expect(missingResponsiveBehavior.definition.category).toBe("layout");
  });

  it("flags container without auto layout or layoutAlign", () => {
    const node = makeNode({ type: "FRAME", name: "Card" });
    const result = missingResponsiveBehavior.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("missing-responsive-behavior");
    expect(result!.message).toContain("Card");
  });

  it("returns null for non-container nodes", () => {
    const node = makeNode({ type: "TEXT" });
    expect(missingResponsiveBehavior.check(node, makeContext())).toBeNull();
  });

  it("returns null when parent has auto layout", () => {
    const node = makeNode({ type: "FRAME", name: "Card" });
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    expect(missingResponsiveBehavior.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null for root-level frames (depth < 2)", () => {
    const node = makeNode({ type: "FRAME" });
    expect(missingResponsiveBehavior.check(node, makeContext({ depth: 1 }))).toBeNull();
  });

  it("returns null when node has auto layout", () => {
    const node = makeNode({ type: "FRAME", layoutMode: "VERTICAL" });
    expect(missingResponsiveBehavior.check(node, makeContext())).toBeNull();
  });

  it("returns null when node has layoutAlign", () => {
    const node = makeNode({ type: "FRAME", layoutAlign: "STRETCH" });
    expect(missingResponsiveBehavior.check(node, makeContext())).toBeNull();
  });
});
