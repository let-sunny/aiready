import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { prototypeLinkInDesign } from "./index.js";

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

describe("prototype-link-in-design", () => {
  it("has correct rule definition metadata", () => {
    expect(prototypeLinkInDesign.definition.id).toBe("prototype-link-in-design");
    expect(prototypeLinkInDesign.definition.category).toBe("handoff-risk");
  });

  it("returns null (stub — requires prototype/interaction data)", () => {
    const node = makeNode({ type: "FRAME", name: "Button" });
    expect(prototypeLinkInDesign.check(node, makeContext())).toBeNull();
  });
});
