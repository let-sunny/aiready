import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { emptyFrame } from "./index.js";

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

describe("empty-frame", () => {
  it("has correct rule definition metadata", () => {
    expect(emptyFrame.definition.id).toBe("empty-frame");
    expect(emptyFrame.definition.category).toBe("ai-readability");
  });

  it("flags empty frame with no children", () => {
    const node = makeNode({
      type: "FRAME",
      name: "EmptySection",
      absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 200 },
    });
    const result = emptyFrame.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("empty-frame");
    expect(result!.message).toContain("EmptySection");
  });

  it("returns null for frame with children", () => {
    const node = makeNode({
      type: "FRAME",
      children: [makeNode({ id: "c:1" })],
    });
    expect(emptyFrame.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-FRAME nodes", () => {
    const node = makeNode({ type: "GROUP" });
    expect(emptyFrame.check(node, makeContext())).toBeNull();
  });

  it("allows small placeholder frames (<=48x48)", () => {
    const node = makeNode({
      type: "FRAME",
      name: "Spacer",
      absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
    });
    expect(emptyFrame.check(node, makeContext())).toBeNull();
  });

  it("flags empty frame without bounding box", () => {
    const node = makeNode({ type: "FRAME", name: "NoBox" });
    const result = emptyFrame.check(node, makeContext());
    expect(result).not.toBeNull();
  });
});
