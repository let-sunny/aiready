import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { groupUsage } from "./index.js";

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

describe("group-usage", () => {
  it("has correct rule definition metadata", () => {
    expect(groupUsage.definition.id).toBe("group-usage");
    expect(groupUsage.definition.category).toBe("layout");
  });

  it("flags GROUP nodes", () => {
    const node = makeNode({ type: "GROUP", name: "My Group" });
    const result = groupUsage.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("group-usage");
    expect(result!.message).toContain("My Group");
  });

  it("returns null for FRAME nodes", () => {
    const node = makeNode({ type: "FRAME" });
    expect(groupUsage.check(node, makeContext())).toBeNull();
  });

  it("returns null for COMPONENT nodes", () => {
    const node = makeNode({ type: "COMPONENT" });
    expect(groupUsage.check(node, makeContext())).toBeNull();
  });

  it("returns null for TEXT nodes", () => {
    const node = makeNode({ type: "TEXT" });
    expect(groupUsage.check(node, makeContext())).toBeNull();
  });
});
