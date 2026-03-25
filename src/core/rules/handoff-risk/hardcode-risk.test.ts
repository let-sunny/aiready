import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { hardcodeRisk } from "./index.js";

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

describe("hardcode-risk", () => {
  it("has correct rule definition metadata", () => {
    expect(hardcodeRisk.definition.id).toBe("hardcode-risk");
    expect(hardcodeRisk.definition.category).toBe("handoff-risk");
  });

  it("flags container with absolute positioning in auto layout parent", () => {
    const parent = makeNode({ layoutMode: "VERTICAL" });
    const node = makeNode({
      type: "FRAME",
      name: "FloatingPanel",
      layoutPositioning: "ABSOLUTE",
    });
    const result = hardcodeRisk.check(node, makeContext({ parent }));
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("hardcode-risk");
    expect(result!.message).toContain("FloatingPanel");
  });

  it("returns null for non-container nodes", () => {
    const parent = makeNode({ layoutMode: "VERTICAL" });
    const node = makeNode({ type: "TEXT", layoutPositioning: "ABSOLUTE" });
    expect(hardcodeRisk.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null when not using absolute positioning", () => {
    const parent = makeNode({ layoutMode: "VERTICAL" });
    const node = makeNode({ type: "FRAME" });
    expect(hardcodeRisk.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null when parent has no auto layout", () => {
    const parent = makeNode({});
    const node = makeNode({ type: "FRAME", layoutPositioning: "ABSOLUTE" });
    expect(hardcodeRisk.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null when no parent", () => {
    const node = makeNode({ type: "FRAME", layoutPositioning: "ABSOLUTE" });
    expect(hardcodeRisk.check(node, makeContext())).toBeNull();
  });
});
