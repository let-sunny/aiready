import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { invisibleLayer } from "./index.js";

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

describe("invisible-layer", () => {
  it("has correct rule definition metadata", () => {
    const def = invisibleLayer.definition;
    expect(def.id).toBe("invisible-layer");
    expect(def.category).toBe("ai-readability");
    expect(def.why).toContain("Hidden layers");
    expect(def.fix).toContain("Slot");
  });

  it("returns null for visible nodes", () => {
    const node = makeNode({ visible: true });
    const ctx = makeContext();
    expect(invisibleLayer.check(node, ctx)).toBeNull();
  });

  it("flags hidden node with basic message", () => {
    const node = makeNode({ visible: false, name: "OldVersion" });
    const ctx = makeContext({ siblings: [node] });

    const result = invisibleLayer.check(node, ctx);
    expect(result).not.toBeNull();
    expect(result!.message).toContain("OldVersion");
    expect(result!.message).toContain("hidden");
    expect(result!.message).toContain("clean up if unused");
  });

  it("skips when parent is also invisible", () => {
    const node = makeNode({ visible: false });
    const parent = makeNode({ visible: false, name: "HiddenParent" });
    const ctx = makeContext({ parent });

    expect(invisibleLayer.check(node, ctx)).toBeNull();
  });

  it("suggests Slot when 3+ hidden siblings", () => {
    const hidden1 = makeNode({ id: "h:1", visible: false, name: "StateA" });
    const hidden2 = makeNode({ id: "h:2", visible: false, name: "StateB" });
    const hidden3 = makeNode({ id: "h:3", visible: false, name: "StateC" });
    const visible1 = makeNode({ id: "v:1", visible: true, name: "Active" });

    const siblings = [hidden1, hidden2, hidden3, visible1];
    const ctx = makeContext({ siblings });

    const result = invisibleLayer.check(hidden1, ctx);
    expect(result).not.toBeNull();
    expect(result!.message).toContain("3 hidden siblings");
    expect(result!.message).toContain("Slot");
  });

  it("does not suggest Slot when fewer than 3 hidden siblings", () => {
    const hidden1 = makeNode({ id: "h:1", visible: false, name: "StateA" });
    const hidden2 = makeNode({ id: "h:2", visible: false, name: "StateB" });
    const visible1 = makeNode({ id: "v:1", visible: true, name: "Active" });

    const siblings = [hidden1, hidden2, visible1];
    const ctx = makeContext({ siblings });

    const result = invisibleLayer.check(hidden1, ctx);
    expect(result).not.toBeNull();
    expect(result!.message).not.toContain("Slot");
    expect(result!.message).toContain("clean up if unused");
  });

  it("handles undefined siblings gracefully", () => {
    const node = makeNode({ visible: false, name: "Hidden" });
    const ctx = makeContext({ siblings: undefined });

    const result = invisibleLayer.check(node, ctx);
    expect(result).not.toBeNull();
    expect(result!.message).toContain("clean up if unused");
  });
});
