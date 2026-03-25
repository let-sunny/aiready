import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { componentPropertyUnused } from "./index.js";

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

describe("component-property-unused", () => {
  it("has correct rule definition metadata", () => {
    expect(componentPropertyUnused.definition.id).toBe("component-property-unused");
    expect(componentPropertyUnused.definition.category).toBe("component");
  });

  it("returns null for non-component nodes", () => {
    const node = makeNode({ type: "FRAME" });
    expect(componentPropertyUnused.check(node, makeContext())).toBeNull();
  });

  it("returns null for components without property definitions", () => {
    const node = makeNode({ type: "COMPONENT" });
    expect(componentPropertyUnused.check(node, makeContext())).toBeNull();
  });

  it("returns null for components with empty property definitions", () => {
    const node = makeNode({ type: "COMPONENT", componentPropertyDefinitions: {} });
    expect(componentPropertyUnused.check(node, makeContext())).toBeNull();
  });

  it("returns null (stub — binding check not yet implemented)", () => {
    const node = makeNode({
      type: "COMPONENT",
      componentPropertyDefinitions: { "label": { type: "TEXT" } },
    });
    expect(componentPropertyUnused.check(node, makeContext())).toBeNull();
  });
});
