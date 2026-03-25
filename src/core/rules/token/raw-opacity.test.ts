import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { rawOpacity } from "./index.js";

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

describe("raw-opacity", () => {
  it("has correct rule definition metadata", () => {
    expect(rawOpacity.definition.id).toBe("raw-opacity");
    expect(rawOpacity.definition.category).toBe("token");
  });

  it("returns null (stub — not yet fully implemented)", () => {
    const node = makeNode({ name: "Overlay" });
    expect(rawOpacity.check(node, makeContext())).toBeNull();
  });

  it("returns null when opacity variable is bound", () => {
    const node = makeNode({ boundVariables: { opacity: "var-opacity-50" } });
    expect(rawOpacity.check(node, makeContext())).toBeNull();
  });
});
