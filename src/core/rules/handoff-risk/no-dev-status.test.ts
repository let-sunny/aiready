import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { noDevStatus } from "./index.js";

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
    depth: 1,
    componentDepth: 0,
    maxDepth: 10,
    path: ["Page"],
    analysisState: new Map(),
    ...overrides,
  };
}

describe("no-dev-status", () => {
  it("has correct rule definition metadata", () => {
    expect(noDevStatus.definition.id).toBe("no-dev-status");
    expect(noDevStatus.definition.category).toBe("handoff-risk");
  });

  it("flags top-level frame without devStatus", () => {
    const node = makeNode({ type: "FRAME", name: "LoginScreen" });
    const result = noDevStatus.check(node, makeContext({ depth: 1 }));
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("no-dev-status");
    expect(result!.message).toContain("LoginScreen");
  });

  it("returns null when devStatus is set", () => {
    const node = makeNode({
      type: "FRAME",
      name: "LoginScreen",
      devStatus: { type: "READY_FOR_DEV" },
    });
    expect(noDevStatus.check(node, makeContext({ depth: 1 }))).toBeNull();
  });

  it("returns null for nested frames (depth > 1)", () => {
    const node = makeNode({ type: "FRAME", name: "Card" });
    expect(noDevStatus.check(node, makeContext({ depth: 2 }))).toBeNull();
  });

  it("returns null for non-FRAME nodes", () => {
    const node = makeNode({ type: "GROUP" });
    expect(noDevStatus.check(node, makeContext({ depth: 1 }))).toBeNull();
  });
});
