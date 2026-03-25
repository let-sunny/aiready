import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { missingLayoutHint } from "./index.js";

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

describe("missing-layout-hint", () => {
  it("has correct rule definition metadata", () => {
    expect(missingLayoutHint.definition.id).toBe("missing-layout-hint");
    expect(missingLayoutHint.definition.category).toBe("ai-readability");
  });

  it("flags container with 2+ nested containers without auto layout", () => {
    const childA = makeNode({ id: "c:1", type: "FRAME", name: "Panel A" });
    const childB = makeNode({ id: "c:2", type: "FRAME", name: "Panel B" });
    const node = makeNode({
      type: "FRAME",
      name: "Wrapper",
      children: [childA, childB],
    });

    const result = missingLayoutHint.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("missing-layout-hint");
    expect(result!.message).toContain("Wrapper");
  });

  it("returns null when node has auto layout", () => {
    const childA = makeNode({ id: "c:1", type: "FRAME" });
    const childB = makeNode({ id: "c:2", type: "FRAME" });
    const node = makeNode({
      type: "FRAME",
      layoutMode: "VERTICAL",
      children: [childA, childB],
    });

    expect(missingLayoutHint.check(node, makeContext())).toBeNull();
  });

  it("returns null when nested containers have auto layout", () => {
    const childA = makeNode({ id: "c:1", type: "FRAME", layoutMode: "HORIZONTAL" });
    const childB = makeNode({ id: "c:2", type: "FRAME", layoutMode: "VERTICAL" });
    const node = makeNode({
      type: "FRAME",
      name: "Wrapper",
      children: [childA, childB],
    });

    expect(missingLayoutHint.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-container nodes", () => {
    const node = makeNode({ type: "TEXT" });
    expect(missingLayoutHint.check(node, makeContext())).toBeNull();
  });

  it("returns null when fewer than 2 nested containers", () => {
    const child = makeNode({ id: "c:1", type: "FRAME" });
    const text = makeNode({ id: "c:2", type: "TEXT" });
    const node = makeNode({
      type: "FRAME",
      name: "Simple",
      children: [child, text],
    });

    expect(missingLayoutHint.check(node, makeContext())).toBeNull();
  });

  it("returns null when no children", () => {
    const node = makeNode({ type: "FRAME" });
    expect(missingLayoutHint.check(node, makeContext())).toBeNull();
  });
});
