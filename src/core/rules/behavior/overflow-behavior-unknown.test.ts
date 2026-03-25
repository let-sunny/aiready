import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { overflowBehaviorUnknown } from "./index.js";

describe("overflow-behavior-unknown", () => {
  it("has correct rule definition metadata", () => {
    expect(overflowBehaviorUnknown.definition.id).toBe("overflow-behavior-unknown");
    expect(overflowBehaviorUnknown.definition.category).toBe("behavior");
  });

  it("flags container with overflowing child and no clip", () => {
    const child = makeNode({
      id: "c:1",
      name: "Overflow",
      absoluteBoundingBox: { x: -10, y: 0, width: 200, height: 50 },
    });
    const node = makeNode({
      type: "FRAME",
      name: "Container",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [child],
    });

    const result = overflowBehaviorUnknown.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("overflow-behavior-unknown");
    expect(result!.message).toContain("Container");
    expect(result!.message).toContain("overflowing");
  });

  it("returns null when clipsContent is true", () => {
    const child = makeNode({
      id: "c:1",
      absoluteBoundingBox: { x: -10, y: 0, width: 200, height: 50 },
    });
    const node = makeNode({
      type: "FRAME",
      name: "Clipped",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      clipsContent: true,
      children: [child],
    });

    expect(overflowBehaviorUnknown.check(node, makeContext())).toBeNull();
  });

  it("returns null when no children overflow", () => {
    const child = makeNode({
      id: "c:1",
      absoluteBoundingBox: { x: 10, y: 10, width: 50, height: 50 },
    });
    const node = makeNode({
      type: "FRAME",
      name: "FitsInside",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [child],
    });

    expect(overflowBehaviorUnknown.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-container nodes", () => {
    const node = makeNode({ type: "TEXT" });
    expect(overflowBehaviorUnknown.check(node, makeContext())).toBeNull();
  });

  it("returns null when no children", () => {
    const node = makeNode({
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    });
    expect(overflowBehaviorUnknown.check(node, makeContext())).toBeNull();
  });

  it("ignores hidden children when checking overflow", () => {
    const child = makeNode({
      id: "c:1",
      visible: false,
      absoluteBoundingBox: { x: -10, y: 0, width: 200, height: 50 },
    });
    const node = makeNode({
      type: "FRAME",
      name: "Container",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [child],
    });

    expect(overflowBehaviorUnknown.check(node, makeContext())).toBeNull();
  });
});
