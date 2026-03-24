import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { repeatedFrameStructure } from "./index.js";

// ============================================
// Test helpers
// ============================================

function makeNode(overrides?: Partial<AnalysisNode>): AnalysisNode {
  return {
    id: "1:1",
    name: "TestFrame",
    type: "FRAME",
    visible: true,
    layoutMode: "VERTICAL",
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
    ...overrides,
  };
}

/**
 * Build a minimal FRAME child node for fingerprint construction.
 */
function makeChildFrame(id: string, type: AnalysisNode["type"] = "FRAME"): AnalysisNode {
  return {
    id,
    name: `child-${id}`,
    type,
    visible: true,
  };
}

// ============================================
// repeated-frame-structure
// ============================================

describe("repeated-frame-structure", () => {
  it("has correct rule definition metadata", () => {
    const def = repeatedFrameStructure.definition;
    expect(def.id).toBe("repeated-frame-structure");
    expect(def.category).toBe("component");
    expect(def.why).toBeTruthy();
    expect(def.impact).toBeTruthy();
    expect(def.fix).toBeTruthy();
  });

  it("returns null for non-FRAME nodes", () => {
    const childFrame = makeChildFrame("c:1");
    const node = makeNode({ type: "TEXT", children: [childFrame] });
    const ctx = makeContext({ siblings: [node] });
    expect(repeatedFrameStructure.check(node, ctx)).toBeNull();
  });

  it("returns null when node has no children", () => {
    const node = makeNode({ id: "f:1", children: undefined });
    const ctx = makeContext({ siblings: [node] });
    expect(repeatedFrameStructure.check(node, ctx)).toBeNull();
  });

  it("returns null when node has empty children array", () => {
    const node = makeNode({ id: "f:1", children: [] });
    const ctx = makeContext({ siblings: [node] });
    expect(repeatedFrameStructure.check(node, ctx)).toBeNull();
  });

  it("returns null when count is below minRepetitions threshold", () => {
    // One sibling with same structure — below default threshold of 2
    const child = makeChildFrame("c:1", "RECTANGLE");
    const frameA = makeNode({ id: "f:1", children: [child] });

    const ctx = makeContext({
      siblings: [frameA],
    });

    expect(repeatedFrameStructure.check(frameA, ctx)).toBeNull();
  });

  it("flags first sibling when count meets minRepetitions threshold (2)", () => {
    const child = makeChildFrame("c:1", "RECTANGLE");
    const frameA = makeNode({ id: "f:1", name: "Card A", children: [child] });
    const frameB = makeNode({ id: "f:2", name: "Card B", children: [child] });

    const siblings = [frameA, frameB];
    const ctx = makeContext({ siblings });

    const result = repeatedFrameStructure.check(frameA, ctx);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("repeated-frame-structure");
    expect(result!.nodeId).toBe("f:1");
    expect(result!.message).toContain("Card A");
    expect(result!.message).toContain("1 sibling frame(s)");
    expect(result!.message).toContain("consider extracting a component");
  });

  it("does not flag non-first siblings with the same fingerprint", () => {
    const child = makeChildFrame("c:1", "RECTANGLE");
    const frameA = makeNode({ id: "f:1", name: "Card A", children: [child] });
    const frameB = makeNode({ id: "f:2", name: "Card B", children: [child] });

    const siblings = [frameA, frameB];
    const ctxB = makeContext({ siblings });

    expect(repeatedFrameStructure.check(frameB, ctxB)).toBeNull();
  });

  it("does not flag frames with different structures", () => {
    const childRect = makeChildFrame("c:1", "RECTANGLE");
    const childText = makeChildFrame("c:2", "TEXT");

    const frameA = makeNode({ id: "f:1", children: [childRect] });
    const frameB = makeNode({ id: "f:2", children: [childText] });
    const frameC = makeNode({ id: "f:3", children: [childText] });

    const siblings = [frameA, frameB, frameC];
    const ctx = makeContext({ siblings });

    // frameA has unique structure — not flagged
    expect(repeatedFrameStructure.check(frameA, ctx)).toBeNull();
  });

  it("skips node when immediate parent is INSTANCE", () => {
    const child = makeChildFrame("c:1", "RECTANGLE");
    const frameA = makeNode({ id: "f:1", children: [child] });
    const frameB = makeNode({ id: "f:2", children: [child] });
    const frameC = makeNode({ id: "f:3", children: [child] });

    const instanceParent: AnalysisNode = {
      id: "inst:1",
      name: "MyInstance",
      type: "INSTANCE",
      visible: true,
    };

    const ctx = makeContext({
      parent: instanceParent,
      siblings: [frameA, frameB, frameC],
    });

    expect(repeatedFrameStructure.check(frameA, ctx)).toBeNull();
  });

  it("skips node when parent is COMPONENT_SET", () => {
    const child = makeChildFrame("c:1", "RECTANGLE");
    const frameA = makeNode({ id: "f:1", children: [child] });
    const frameB = makeNode({ id: "f:2", children: [child] });
    const frameC = makeNode({ id: "f:3", children: [child] });

    const compSetParent: AnalysisNode = {
      id: "cs:1",
      name: "ButtonSet",
      type: "COMPONENT_SET",
      visible: true,
    };

    const ctx = makeContext({
      parent: compSetParent,
      siblings: [frameA, frameB, frameC],
    });

    expect(repeatedFrameStructure.check(frameA, ctx)).toBeNull();
  });

  it("treats undefined siblings as empty array (no violation)", () => {
    const child = makeChildFrame("c:1", "RECTANGLE");
    const node = makeNode({ id: "f:1", children: [child] });
    const ctx = makeContext({ siblings: undefined });

    // With no siblings, count is 1 (self only) — below threshold of 2
    expect(repeatedFrameStructure.check(node, ctx)).toBeNull();
  });

  it("respects custom minRepetitions option", () => {
    const child = makeChildFrame("c:1", "RECTANGLE");
    const frameA = makeNode({ id: "f:1", name: "Card A", children: [child] });
    const frameB = makeNode({ id: "f:2", name: "Card B", children: [child] });

    const siblings = [frameA, frameB];
    const ctx = makeContext({ siblings });

    // Default threshold is 2 — should flag with 2 siblings
    const result = repeatedFrameStructure.check(frameA, ctx);
    expect(result).not.toBeNull();

    // With minRepetitions: 3 — should NOT flag with only 2
    expect(repeatedFrameStructure.check(frameA, ctx, { minRepetitions: 3 })).toBeNull();
  });

  it("includes node path in violation", () => {
    const child = makeChildFrame("c:1", "RECTANGLE");
    const frameA = makeNode({ id: "f:1", name: "Card A", children: [child] });
    const frameB = makeNode({ id: "f:2", name: "Card B", children: [child] });
    const frameC = makeNode({ id: "f:3", name: "Card C", children: [child] });

    const siblings = [frameA, frameB, frameC];
    const ctx = makeContext({
      siblings,
      path: ["Page", "Section", "Row"],
    });

    const result = repeatedFrameStructure.check(frameA, ctx);
    expect(result).not.toBeNull();
    expect(result!.nodePath).toBe("Page > Section > Row");
  });

  it("does not flag siblings that are not FRAME type", () => {
    // sibling list includes non-FRAME nodes — they should be ignored
    const child = makeChildFrame("c:1", "RECTANGLE");
    const frameA = makeNode({ id: "f:1", name: "Card A", children: [child] });
    const textNode: AnalysisNode = {
      id: "t:1",
      name: "Label",
      type: "TEXT",
      visible: true,
      children: [child],
    };
    const groupNode: AnalysisNode = {
      id: "g:1",
      name: "Group",
      type: "GROUP",
      visible: true,
      children: [child],
    };

    const siblings = [frameA, textNode, groupNode];
    const ctx = makeContext({ siblings });

    // Only one qualifying FRAME sibling — below threshold
    expect(repeatedFrameStructure.check(frameA, ctx)).toBeNull();
  });
});
