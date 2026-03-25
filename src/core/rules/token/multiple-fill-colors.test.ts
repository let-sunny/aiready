import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { multipleFillColors } from "./index.js";

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

describe("multiple-fill-colors", () => {
  it("has correct rule definition metadata", () => {
    expect(multipleFillColors.definition.id).toBe("multiple-fill-colors");
    expect(multipleFillColors.definition.category).toBe("token");
  });

  it("returns null (stub — requires cross-node analysis)", () => {
    const node = makeNode({
      fills: [
        { type: "SOLID", color: { r: 1, g: 0, b: 0 } },
        { type: "SOLID", color: { r: 0.98, g: 0.01, b: 0.01 } },
      ],
    });
    expect(multipleFillColors.check(node, makeContext())).toBeNull();
  });
});
