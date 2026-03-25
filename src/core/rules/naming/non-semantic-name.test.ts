import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { nonSemanticName } from "./index.js";

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

describe("non-semantic-name", () => {
  it("has correct rule definition metadata", () => {
    expect(nonSemanticName.definition.id).toBe("non-semantic-name");
    expect(nonSemanticName.definition.category).toBe("naming");
  });

  it("flags non-semantic name on container node", () => {
    const node = makeNode({ type: "FRAME", name: "ellipse", children: [makeNode()] });
    const result = nonSemanticName.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("non-semantic-name");
  });

  it.each(["ellipse", "vector", "line", "polygon", "star", "path", "shape", "fill", "stroke"])(
    "flags non-semantic name: %s (on container)",
    (name) => {
      const node = makeNode({ type: "FRAME", name, children: [makeNode()] });
      expect(nonSemanticName.check(node, makeContext())).not.toBeNull();
    },
  );

  it.each(["rectangle", "image"])(
    "returns null for %s (excluded by name pattern)",
    (name) => {
      const node = makeNode({ type: "FRAME", name, children: [makeNode()] });
      expect(nonSemanticName.check(node, makeContext())).toBeNull();
    },
  );

  it("allows non-semantic names on leaf shape primitives", () => {
    const node = makeNode({ type: "RECTANGLE", name: "rectangle" });
    expect(nonSemanticName.check(node, makeContext())).toBeNull();
  });

  it("allows non-semantic names on leaf ELLIPSE", () => {
    const node = makeNode({ type: "ELLIPSE", name: "ellipse" });
    expect(nonSemanticName.check(node, makeContext())).toBeNull();
  });

  it("returns null for semantic names", () => {
    const node = makeNode({ name: "Divider" });
    expect(nonSemanticName.check(node, makeContext())).toBeNull();
  });

  it("returns null for excluded name patterns", () => {
    const node = makeNode({ name: "icon" });
    expect(nonSemanticName.check(node, makeContext())).toBeNull();
  });
});
