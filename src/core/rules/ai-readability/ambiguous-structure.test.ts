import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { ambiguousStructure } from "./index.js";

describe("ambiguous-structure", () => {
  it("has correct rule definition metadata", () => {
    const def = ambiguousStructure.definition;
    expect(def.id).toBe("ambiguous-structure");
    expect(def.category).toBe("ai-readability");
    expect(def.why).toContain("Overlapping");
    expect(def.fix).toContain("Auto Layout");
  });

  it("returns null for non-container nodes", () => {
    const node = makeNode({ type: "TEXT" });
    const ctx = makeContext();
    expect(ambiguousStructure.check(node, ctx)).toBeNull();
  });

  it("returns null for container with auto layout", () => {
    const child1 = makeNode({ id: "c:1" });
    const child2 = makeNode({ id: "c:2" });
    const node = makeNode({
      layoutMode: "HORIZONTAL",
      children: [child1, child2],
    });
    const ctx = makeContext();
    expect(ambiguousStructure.check(node, ctx)).toBeNull();
  });

  it("returns null for container with only 1 child", () => {
    const child = makeNode({ id: "c:1" });
    const node = makeNode({ children: [child] });
    const ctx = makeContext();
    expect(ambiguousStructure.check(node, ctx)).toBeNull();
  });

  it("returns null for non-overlapping children", () => {
    const child1 = makeNode({
      id: "c:1",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    });
    const child2 = makeNode({
      id: "c:2",
      absoluteBoundingBox: { x: 200, y: 0, width: 100, height: 100 },
    });
    const node = makeNode({
      name: "Container",
      children: [child1, child2],
    });
    const ctx = makeContext();
    expect(ambiguousStructure.check(node, ctx)).toBeNull();
  });

  it("flags container with overlapping visible children", () => {
    const child1 = makeNode({
      id: "c:1",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    });
    const child2 = makeNode({
      id: "c:2",
      absoluteBoundingBox: { x: 50, y: 50, width: 100, height: 100 },
    });
    const node = makeNode({
      name: "Ambiguous",
      children: [child1, child2],
    });
    const ctx = makeContext();

    const result = ambiguousStructure.check(node, ctx);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("ambiguous-structure");
    expect(result!.message).toContain("Ambiguous");
    expect(result!.message).toContain("overlapping");
  });

  it("returns null when overlapping children are hidden", () => {
    const child1 = makeNode({
      id: "c:1",
      visible: false,
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    });
    const child2 = makeNode({
      id: "c:2",
      absoluteBoundingBox: { x: 50, y: 50, width: 100, height: 100 },
    });
    const node = makeNode({
      name: "Container",
      children: [child1, child2],
    });
    const ctx = makeContext();
    expect(ambiguousStructure.check(node, ctx)).toBeNull();
  });

  it("works with GROUP container type", () => {
    const child1 = makeNode({
      id: "c:1",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    });
    const child2 = makeNode({
      id: "c:2",
      absoluteBoundingBox: { x: 50, y: 50, width: 100, height: 100 },
    });
    const node = makeNode({
      name: "GroupContainer",
      type: "GROUP",
      children: [child1, child2],
    });
    const ctx = makeContext();

    const result = ambiguousStructure.check(node, ctx);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("ambiguous-structure");
  });
});
