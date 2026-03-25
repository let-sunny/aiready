import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { wrapBehaviorUnknown } from "./index.js";

describe("wrap-behavior-unknown", () => {
  it("has correct rule definition metadata", () => {
    expect(wrapBehaviorUnknown.definition.id).toBe("wrap-behavior-unknown");
    expect(wrapBehaviorUnknown.definition.category).toBe("behavior");
  });

  it("flags horizontal auto layout with 3+ children exceeding width", () => {
    const child1 = makeNode({
      id: "c:1",
      absoluteBoundingBox: { x: 0, y: 0, width: 150, height: 50 },
    });
    const child2 = makeNode({
      id: "c:2",
      absoluteBoundingBox: { x: 150, y: 0, width: 150, height: 50 },
    });
    const child3 = makeNode({
      id: "c:3",
      absoluteBoundingBox: { x: 300, y: 0, width: 150, height: 50 },
    });
    const node = makeNode({
      type: "FRAME",
      name: "TagList",
      layoutMode: "HORIZONTAL",
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 50 },
      children: [child1, child2, child3],
    });

    const result = wrapBehaviorUnknown.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("wrap-behavior-unknown");
    expect(result!.message).toContain("TagList");
    expect(result!.message).toContain("3 horizontal children");
  });

  it("returns null when layoutWrap is WRAP", () => {
    const child1 = makeNode({
      id: "c:1",
      absoluteBoundingBox: { x: 0, y: 0, width: 150, height: 50 },
    });
    const child2 = makeNode({
      id: "c:2",
      absoluteBoundingBox: { x: 150, y: 0, width: 150, height: 50 },
    });
    const child3 = makeNode({
      id: "c:3",
      absoluteBoundingBox: { x: 300, y: 0, width: 150, height: 50 },
    });
    const node = makeNode({
      type: "FRAME",
      name: "WrappedList",
      layoutMode: "HORIZONTAL",
      layoutWrap: "WRAP",
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 100 },
      children: [child1, child2, child3],
    });

    expect(wrapBehaviorUnknown.check(node, makeContext())).toBeNull();
  });

  it("returns null for vertical auto layout", () => {
    const child1 = makeNode({ id: "c:1", absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 200 } });
    const child2 = makeNode({ id: "c:2", absoluteBoundingBox: { x: 0, y: 200, width: 100, height: 200 } });
    const child3 = makeNode({ id: "c:3", absoluteBoundingBox: { x: 0, y: 400, width: 100, height: 200 } });
    const node = makeNode({
      type: "FRAME",
      name: "VertList",
      layoutMode: "VERTICAL",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 400 },
      children: [child1, child2, child3],
    });

    expect(wrapBehaviorUnknown.check(node, makeContext())).toBeNull();
  });

  it("returns null when fewer than 3 visible children", () => {
    const child1 = makeNode({
      id: "c:1",
      absoluteBoundingBox: { x: 0, y: 0, width: 150, height: 50 },
    });
    const child2 = makeNode({
      id: "c:2",
      absoluteBoundingBox: { x: 150, y: 0, width: 150, height: 50 },
    });
    const node = makeNode({
      type: "FRAME",
      name: "ShortList",
      layoutMode: "HORIZONTAL",
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 50 },
      children: [child1, child2],
    });

    expect(wrapBehaviorUnknown.check(node, makeContext())).toBeNull();
  });

  it("returns null when children fit within parent width", () => {
    const child1 = makeNode({
      id: "c:1",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 50 },
    });
    const child2 = makeNode({
      id: "c:2",
      absoluteBoundingBox: { x: 100, y: 0, width: 100, height: 50 },
    });
    const child3 = makeNode({
      id: "c:3",
      absoluteBoundingBox: { x: 200, y: 0, width: 100, height: 50 },
    });
    const node = makeNode({
      type: "FRAME",
      name: "FitsList",
      layoutMode: "HORIZONTAL",
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 50 },
      children: [child1, child2, child3],
    });

    expect(wrapBehaviorUnknown.check(node, makeContext())).toBeNull();
  });
});
