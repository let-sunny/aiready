import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { imageNoPlaceholder } from "./index.js";

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

describe("image-no-placeholder", () => {
  it("has correct rule definition metadata", () => {
    expect(imageNoPlaceholder.definition.id).toBe("image-no-placeholder");
    expect(imageNoPlaceholder.definition.category).toBe("handoff-risk");
  });

  it("flags RECTANGLE with only IMAGE fill (no placeholder)", () => {
    const node = makeNode({
      type: "RECTANGLE",
      name: "Hero Image",
      fills: [{ type: "IMAGE", imageRef: "abc123" }],
    });
    const result = imageNoPlaceholder.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("image-no-placeholder");
    expect(result!.message).toContain("Hero Image");
  });

  it("returns null for RECTANGLE with multiple fills (has placeholder)", () => {
    const node = makeNode({
      type: "RECTANGLE",
      name: "Image",
      fills: [
        { type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } },
        { type: "IMAGE", imageRef: "abc123" },
      ],
    });
    expect(imageNoPlaceholder.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-image nodes", () => {
    const node = makeNode({ type: "FRAME" });
    expect(imageNoPlaceholder.check(node, makeContext())).toBeNull();
  });

  it("returns null for RECTANGLE with SOLID fill only", () => {
    const node = makeNode({
      type: "RECTANGLE",
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
    });
    expect(imageNoPlaceholder.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-RECTANGLE with image fill", () => {
    const node = makeNode({
      type: "FRAME",
      fills: [{ type: "IMAGE" }],
    });
    expect(imageNoPlaceholder.check(node, makeContext())).toBeNull();
  });
});
