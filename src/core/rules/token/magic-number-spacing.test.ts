import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { magicNumberSpacing } from "./index.js";

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

describe("magic-number-spacing", () => {
  it("has correct rule definition metadata", () => {
    expect(magicNumberSpacing.definition.id).toBe("magic-number-spacing");
    expect(magicNumberSpacing.definition.category).toBe("token");
  });

  it("flags odd magic number padding (e.g. 13px)", () => {
    const node = makeNode({ name: "Card", paddingLeft: 13 });
    const result = magicNumberSpacing.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("magic-number-spacing");
    expect(result!.message).toContain("13");
  });

  it("flags odd magic number itemSpacing (e.g. 17px)", () => {
    const node = makeNode({ name: "List", itemSpacing: 17 });
    const result = magicNumberSpacing.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.message).toContain("17");
  });

  it("returns null for grid-aligned spacing (e.g. 8px on 4pt grid)", () => {
    const node = makeNode({ paddingLeft: 8, paddingTop: 16 });
    expect(magicNumberSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null for small intentional values (1, 2, 4)", () => {
    const node = makeNode({ paddingLeft: 1 });
    expect(magicNumberSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null for even off-grid values (e.g. 6px)", () => {
    const node = makeNode({ paddingLeft: 6 });
    expect(magicNumberSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null when no spacing values exist", () => {
    const node = makeNode({});
    expect(magicNumberSpacing.check(node, makeContext())).toBeNull();
  });

  it("respects custom gridBase option", () => {
    const node = makeNode({ name: "Card", paddingLeft: 9 });
    expect(magicNumberSpacing.check(node, makeContext(), { gridBase: 3 })).toBeNull();
  });
});
