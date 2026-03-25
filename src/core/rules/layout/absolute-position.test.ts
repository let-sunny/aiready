import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { absolutePositionInAutoLayout } from "./index.js";

describe("absolute-position-in-auto-layout", () => {
  it("has correct rule definition metadata", () => {
    const def = absolutePositionInAutoLayout.definition;
    expect(def.id).toBe("absolute-position-in-auto-layout");
    expect(def.category).toBe("layout");
    expect(def.why).toContain("Absolute positioning");
    expect(def.fix).toContain("absolute positioning");
  });

  it("returns null when no parent", () => {
    const node = makeNode({ layoutPositioning: "ABSOLUTE" });
    const ctx = makeContext();
    expect(absolutePositionInAutoLayout.check(node, ctx)).toBeNull();
  });

  it("returns null when parent has no auto layout", () => {
    const parent = makeNode({ id: "p:1", name: "Parent" });
    const node = makeNode({ layoutPositioning: "ABSOLUTE" });
    const ctx = makeContext({ parent });
    expect(absolutePositionInAutoLayout.check(node, ctx)).toBeNull();
  });

  it("returns null for non-absolute node", () => {
    const parent = makeNode({
      id: "p:1",
      name: "Parent",
      layoutMode: "HORIZONTAL",
    });
    const node = makeNode({ layoutPositioning: "AUTO" });
    const ctx = makeContext({ parent });
    expect(absolutePositionInAutoLayout.check(node, ctx)).toBeNull();
  });

  it("flags absolute positioned node in auto layout parent", () => {
    const parent = makeNode({
      id: "p:1",
      name: "AutoParent",
      layoutMode: "HORIZONTAL",
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 400 },
    });
    const node = makeNode({
      name: "AbsChild",
      layoutPositioning: "ABSOLUTE",
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 200 },
    });
    const ctx = makeContext({ parent });

    const result = absolutePositionInAutoLayout.check(node, ctx);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("absolute-position-in-auto-layout");
    expect(result!.message).toContain("AbsChild");
    expect(result!.message).toContain("absolute positioning");
  });

  it("skips vector/graphic nodes", () => {
    const parent = makeNode({
      id: "p:1",
      name: "Parent",
      layoutMode: "HORIZONTAL",
    });
    const vectorNode = makeNode({
      type: "VECTOR",
      layoutPositioning: "ABSOLUTE",
    });
    const ctx = makeContext({ parent });
    expect(absolutePositionInAutoLayout.check(vectorNode, ctx)).toBeNull();
  });

  it("skips nodes inside COMPONENT parent", () => {
    const parent = makeNode({
      id: "p:1",
      name: "CompParent",
      type: "COMPONENT",
      layoutMode: "VERTICAL",
    });
    const node = makeNode({
      name: "InnerNode",
      layoutPositioning: "ABSOLUTE",
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 200 },
    });
    const ctx = makeContext({ parent });
    expect(absolutePositionInAutoLayout.check(node, ctx)).toBeNull();
  });

  it("skips small decorations (< 25% parent size)", () => {
    const parent = makeNode({
      id: "p:1",
      name: "BigParent",
      layoutMode: "HORIZONTAL",
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 400 },
    });
    const smallNode = makeNode({
      name: "SmallBadge",
      layoutPositioning: "ABSOLUTE",
      absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 },
    });
    const ctx = makeContext({ parent });
    expect(absolutePositionInAutoLayout.check(smallNode, ctx)).toBeNull();
  });
});
