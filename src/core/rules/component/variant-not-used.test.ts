import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { variantNotUsed } from "./index.js";

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

describe("variant-not-used", () => {
  it("has correct rule definition metadata", () => {
    expect(variantNotUsed.definition.id).toBe("variant-not-used");
    expect(variantNotUsed.definition.category).toBe("component");
  });

  it("returns null (stub — requires component variant context)", () => {
    const node = makeNode({ type: "INSTANCE", componentId: "comp-1" });
    expect(variantNotUsed.check(node, makeContext())).toBeNull();
  });
});
