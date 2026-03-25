import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { textTruncationUnhandled } from "./index.js";

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

describe("text-truncation-unhandled", () => {
  it("has correct rule definition metadata", () => {
    expect(textTruncationUnhandled.definition.id).toBe("text-truncation-unhandled");
    expect(textTruncationUnhandled.definition.category).toBe("handoff-risk");
  });

  it("flags long text in constrained auto layout parent", () => {
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    const node = makeNode({
      type: "TEXT",
      name: "Description",
      characters: "A".repeat(60),
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 20 },
    });
    const result = textTruncationUnhandled.check(node, makeContext({ parent }));
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("text-truncation-unhandled");
  });

  it("returns null for non-TEXT nodes", () => {
    const node = makeNode({ type: "FRAME" });
    expect(textTruncationUnhandled.check(node, makeContext())).toBeNull();
  });

  it("returns null when parent has no auto layout", () => {
    const parent = makeNode({});
    const node = makeNode({
      type: "TEXT",
      characters: "A".repeat(60),
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 20 },
    });
    expect(textTruncationUnhandled.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null for short text", () => {
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    const node = makeNode({
      type: "TEXT",
      name: "Label",
      characters: "Short",
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 20 },
    });
    expect(textTruncationUnhandled.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null for wide text container (>= 300px)", () => {
    const parent = makeNode({ layoutMode: "HORIZONTAL" });
    const node = makeNode({
      type: "TEXT",
      characters: "A".repeat(60),
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 20 },
    });
    expect(textTruncationUnhandled.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null when no parent", () => {
    const node = makeNode({
      type: "TEXT",
      characters: "A".repeat(60),
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 20 },
    });
    expect(textTruncationUnhandled.check(node, makeContext())).toBeNull();
  });
});
