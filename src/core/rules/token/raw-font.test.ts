import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { rawFont } from "./index.js";

function makeNode(overrides?: Partial<AnalysisNode>): AnalysisNode {
  return {
    id: "1:1",
    name: "TestNode",
    type: "FRAME",
    visible: true,
    ...overrides,
  };
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

describe("raw-font", () => {
  it("has correct rule definition metadata", () => {
    expect(rawFont.definition.id).toBe("raw-font");
    expect(rawFont.definition.category).toBe("token");
  });

  it("returns null for non-TEXT nodes", () => {
    const node = makeNode({ type: "FRAME" });
    expect(rawFont.check(node, makeContext())).toBeNull();
  });

  it("returns null when text style is applied", () => {
    const node = makeNode({
      type: "TEXT",
      name: "Label",
      styles: { text: "style-123" },
    });
    expect(rawFont.check(node, makeContext())).toBeNull();
  });

  it("returns null when fontFamily variable is bound", () => {
    const node = makeNode({
      type: "TEXT",
      name: "Label",
      boundVariables: { fontFamily: "var-123" },
    });
    expect(rawFont.check(node, makeContext())).toBeNull();
  });

  it("returns null when fontSize variable is bound", () => {
    const node = makeNode({
      type: "TEXT",
      name: "Label",
      boundVariables: { fontSize: "var-456" },
    });
    expect(rawFont.check(node, makeContext())).toBeNull();
  });

  it("flags TEXT node without any text style or variable", () => {
    const node = makeNode({ type: "TEXT", name: "Unstyled Label" });
    const result = rawFont.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("raw-font");
    expect(result!.message).toContain("Unstyled Label");
  });
});
