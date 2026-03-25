import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { inconsistentSpacing } from "./index.js";

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

describe("inconsistent-spacing", () => {
  it("has correct rule definition metadata", () => {
    expect(inconsistentSpacing.definition.id).toBe("inconsistent-spacing");
    expect(inconsistentSpacing.definition.category).toBe("token");
  });

  it("flags padding not on 4pt grid", () => {
    const node = makeNode({ name: "Card", paddingLeft: 5 });
    const result = inconsistentSpacing.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("inconsistent-spacing");
    expect(result!.message).toContain("5");
  });

  it("flags itemSpacing not on 4pt grid", () => {
    const node = makeNode({ name: "List", itemSpacing: 7 });
    const result = inconsistentSpacing.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.message).toContain("7");
  });

  it("returns null for grid-aligned padding", () => {
    const node = makeNode({ paddingLeft: 8, paddingTop: 12 });
    expect(inconsistentSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null for grid-aligned itemSpacing", () => {
    const node = makeNode({ itemSpacing: 16 });
    expect(inconsistentSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null when no spacing values", () => {
    const node = makeNode({});
    expect(inconsistentSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null for zero padding", () => {
    const node = makeNode({ paddingLeft: 0 });
    expect(inconsistentSpacing.check(node, makeContext())).toBeNull();
  });

  it("respects custom gridBase option", () => {
    const node = makeNode({ paddingLeft: 6 });
    expect(inconsistentSpacing.check(node, makeContext(), { gridBase: 3 })).toBeNull();
  });
});
