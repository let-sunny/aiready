import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { inconsistentSiblingLayoutDirection } from "./index.js";

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

describe("inconsistent-sibling-layout-direction", () => {
  it("has correct rule definition metadata", () => {
    expect(inconsistentSiblingLayoutDirection.definition.id).toBe("inconsistent-sibling-layout-direction");
    expect(inconsistentSiblingLayoutDirection.definition.category).toBe("layout");
  });

  it("flags node with different direction from siblings", () => {
    const siblingA = makeNode({ id: "2:1", type: "FRAME", name: "SibA", layoutMode: "HORIZONTAL" });
    const siblingB = makeNode({ id: "2:2", type: "FRAME", name: "SibB", layoutMode: "HORIZONTAL" });
    const node = makeNode({ id: "1:1", type: "FRAME", name: "Outlier", layoutMode: "VERTICAL" });
    const siblings = [node, siblingA, siblingB];

    const result = inconsistentSiblingLayoutDirection.check(node, makeContext({ siblings }));
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("inconsistent-sibling-layout-direction");
    expect(result!.message).toContain("VERTICAL");
    expect(result!.message).toContain("HORIZONTAL");
  });

  it("returns null for non-container nodes", () => {
    const node = makeNode({ type: "TEXT" });
    expect(inconsistentSiblingLayoutDirection.check(node, makeContext())).toBeNull();
  });

  it("returns null when no siblings", () => {
    const node = makeNode({ type: "FRAME", layoutMode: "VERTICAL" });
    expect(inconsistentSiblingLayoutDirection.check(node, makeContext())).toBeNull();
  });

  it("returns null when all siblings have the same direction", () => {
    const siblingA = makeNode({ id: "2:1", type: "FRAME", name: "SibA", layoutMode: "VERTICAL" });
    const node = makeNode({ id: "1:1", type: "FRAME", name: "Card", layoutMode: "VERTICAL" });
    const siblings = [node, siblingA];

    expect(inconsistentSiblingLayoutDirection.check(node, makeContext({ siblings }))).toBeNull();
  });

  it("returns null when node has no layout mode", () => {
    const siblingA = makeNode({ id: "2:1", type: "FRAME", name: "SibA", layoutMode: "HORIZONTAL" });
    const node = makeNode({ id: "1:1", type: "FRAME", name: "Plain" });
    const siblings = [node, siblingA];

    expect(inconsistentSiblingLayoutDirection.check(node, makeContext({ siblings }))).toBeNull();
  });

  it("allows card-in-row pattern (parent HORIZONTAL, child VERTICAL)", () => {
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    const siblingA = makeNode({ id: "2:1", type: "FRAME", name: "SibA", layoutMode: "HORIZONTAL" });
    const siblingB = makeNode({ id: "2:2", type: "FRAME", name: "SibB", layoutMode: "HORIZONTAL" });
    const node = makeNode({ id: "1:1", type: "FRAME", name: "Card", layoutMode: "VERTICAL" });
    const siblings = [node, siblingA, siblingB];

    expect(inconsistentSiblingLayoutDirection.check(node, makeContext({ parent, siblings }))).toBeNull();
  });
});
