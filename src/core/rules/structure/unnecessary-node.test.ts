import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { unnecessaryNode } from "./index.js";

describe("unnecessary-node", () => {
  it("has correct rule definition metadata", () => {
    const def = unnecessaryNode.definition;
    expect(def.id).toBe("unnecessary-node");
    expect(def.category).toBe("structure");
  });

  // Invisible layer checks
  it("returns null for visible non-empty nodes", () => {
    const node = makeNode({ visible: true, type: "TEXT" });
    const ctx = makeContext();
    expect(unnecessaryNode.check(node, ctx)).toBeNull();
  });

  it("flags hidden node with basic message", () => {
    const node = makeNode({ visible: false, name: "OldVersion" });
    const ctx = makeContext({ siblings: [node] });

    const result = unnecessaryNode.check(node, ctx);
    expect(result).not.toBeNull();
    expect(result!.message).toContain("OldVersion");
    expect(result!.message).toContain("hidden");
    expect(result!.message).toContain("clean up if unused");
  });

  it("skips when parent is also invisible", () => {
    const node = makeNode({ visible: false });
    const parent = makeNode({ visible: false, name: "HiddenParent" });
    const ctx = makeContext({ parent });

    expect(unnecessaryNode.check(node, ctx)).toBeNull();
  });

  it("suggests Slot when 3+ hidden siblings", () => {
    const hidden1 = makeNode({ id: "h:1", visible: false, name: "StateA" });
    const hidden2 = makeNode({ id: "h:2", visible: false, name: "StateB" });
    const hidden3 = makeNode({ id: "h:3", visible: false, name: "StateC" });
    const visible1 = makeNode({ id: "v:1", visible: true, name: "Active" });

    const siblings = [hidden1, hidden2, hidden3, visible1];
    const ctx = makeContext({ siblings });

    const result = unnecessaryNode.check(hidden1, ctx);
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

    const result = unnecessaryNode.check(hidden1, ctx);
    expect(result).not.toBeNull();
    expect(result!.message).not.toContain("Slot");
    expect(result!.message).toContain("clean up if unused");
  });

  // Empty frame checks
  it("flags empty frame with no children", () => {
    const node = makeNode({
      type: "FRAME",
      name: "EmptySection",
      absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 200 },
    });
    const result = unnecessaryNode.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("unnecessary-node");
    expect(result!.message).toContain("empty frame");
  });

  it("returns null for frame with children", () => {
    const node = makeNode({
      type: "FRAME",
      children: [makeNode({ id: "c:1" })],
    });
    expect(unnecessaryNode.check(node, makeContext())).toBeNull();
  });

  it("allows small placeholder frames (<=48x48)", () => {
    const node = makeNode({
      type: "FRAME",
      name: "Spacer",
      absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
    });
    expect(unnecessaryNode.check(node, makeContext())).toBeNull();
  });

  it("flags empty frame without bounding box", () => {
    const node = makeNode({ type: "FRAME", name: "NoBox" });
    const result = unnecessaryNode.check(node, makeContext());
    expect(result).not.toBeNull();
  });
});
