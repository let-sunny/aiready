import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { defaultName } from "./index.js";

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

describe("default-name", () => {
  it("has correct rule definition metadata", () => {
    expect(defaultName.definition.id).toBe("default-name");
    expect(defaultName.definition.category).toBe("naming");
  });

  it.each([
    "Frame 1",
    "Frame",
    "Group 12",
    "Ellipse",
    "Vector 1",
    "Line 5",
    "Text 2",
    "Component 1",
    "Instance 3",
  ])("flags default name: %s", (name) => {
    const node = makeNode({ name });
    const result = defaultName.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("default-name");
  });

  it("returns null for semantic names", () => {
    const node = makeNode({ name: "ProductCard" });
    expect(defaultName.check(node, makeContext())).toBeNull();
  });

  it("returns null for excluded name patterns", () => {
    const node = makeNode({ name: "Icon Badge" });
    expect(defaultName.check(node, makeContext())).toBeNull();
  });

  it("returns null when name is empty", () => {
    const node = makeNode({ name: "" });
    expect(defaultName.check(node, makeContext())).toBeNull();
  });
});
