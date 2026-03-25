import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { tooLongName } from "./index.js";

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

describe("too-long-name", () => {
  it("has correct rule definition metadata", () => {
    expect(tooLongName.definition.id).toBe("too-long-name");
    expect(tooLongName.definition.category).toBe("naming");
  });

  it("flags name longer than default max (50)", () => {
    const longName = "A".repeat(51);
    const node = makeNode({ name: longName });
    const result = tooLongName.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("too-long-name");
    expect(result!.message).toContain("51");
  });

  it("returns null for name at exactly max length", () => {
    const node = makeNode({ name: "A".repeat(50) });
    expect(tooLongName.check(node, makeContext())).toBeNull();
  });

  it("returns null for short names", () => {
    const node = makeNode({ name: "Card" });
    expect(tooLongName.check(node, makeContext())).toBeNull();
  });

  it("returns null for empty name", () => {
    const node = makeNode({ name: "" });
    expect(tooLongName.check(node, makeContext())).toBeNull();
  });

  it("respects custom maxLength option", () => {
    const node = makeNode({ name: "A".repeat(21) });
    const result = tooLongName.check(node, makeContext(), { maxLength: 20 });
    expect(result).not.toBeNull();
    expect(result!.message).toContain("21");
  });

  it("returns null when under custom maxLength", () => {
    const node = makeNode({ name: "A".repeat(20) });
    expect(tooLongName.check(node, makeContext(), { maxLength: 20 })).toBeNull();
  });
});
