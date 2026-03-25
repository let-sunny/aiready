import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { detachedInstance } from "./index.js";

function makeNode(overrides?: Partial<AnalysisNode>): AnalysisNode {
  return { id: "1:1", name: "TestNode", type: "FRAME", visible: true, ...overrides };
}

function makeFile(overrides?: Partial<AnalysisFile>): AnalysisFile {
  return {
    fileKey: "test-file",
    name: "Test File",
    lastModified: "2026-01-01T00:00:00Z",
    version: "1",
    document: makeNode({ id: "0:1", name: "Document", type: "DOCUMENT" }),
    components: {},
    styles: {},
    ...overrides,
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

describe("detached-instance", () => {
  it("has correct rule definition metadata", () => {
    expect(detachedInstance.definition.id).toBe("detached-instance");
    expect(detachedInstance.definition.category).toBe("component");
  });

  it("flags FRAME whose name matches a component", () => {
    const file = makeFile({
      components: {
        "comp-1": { key: "k1", name: "Button", description: "A button" },
      },
    });
    const node = makeNode({ type: "FRAME", name: "Button" });
    const result = detachedInstance.check(node, makeContext({ file }));
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("detached-instance");
    expect(result!.message).toContain("Button");
  });

  it("flags FRAME whose name contains a component name", () => {
    const file = makeFile({
      components: {
        "comp-1": { key: "k1", name: "Card", description: "" },
      },
    });
    const node = makeNode({ type: "FRAME", name: "Card Copy" });
    const result = detachedInstance.check(node, makeContext({ file }));
    expect(result).not.toBeNull();
    expect(result!.message).toContain("Card");
  });

  it("returns null for non-FRAME nodes", () => {
    const node = makeNode({ type: "INSTANCE" });
    expect(detachedInstance.check(node, makeContext())).toBeNull();
  });

  it("returns null when no components match", () => {
    const file = makeFile({
      components: {
        "comp-1": { key: "k1", name: "Checkbox", description: "" },
      },
    });
    const node = makeNode({ type: "FRAME", name: "Header" });
    expect(detachedInstance.check(node, makeContext({ file }))).toBeNull();
  });

  it("returns null when file has no components", () => {
    const node = makeNode({ type: "FRAME", name: "SomeFrame" });
    expect(detachedInstance.check(node, makeContext())).toBeNull();
  });
});
