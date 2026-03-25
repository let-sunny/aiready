import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { noAutoLayout } from "./index.js";

describe("no-auto-layout", () => {
  it("has correct rule definition metadata", () => {
    const def = noAutoLayout.definition;
    expect(def.id).toBe("no-auto-layout");
    expect(def.category).toBe("layout");
    expect(def.why).toContain("Auto Layout");
    expect(def.fix).toContain("Auto Layout");
  });

  it("returns null for non-FRAME nodes", () => {
    const textNode = makeNode({ type: "TEXT" });
    const ctx = makeContext();
    expect(noAutoLayout.check(textNode, ctx)).toBeNull();

    const groupNode = makeNode({ type: "GROUP" });
    expect(noAutoLayout.check(groupNode, ctx)).toBeNull();
  });

  it("returns null for frame with auto layout", () => {
    const node = makeNode({
      layoutMode: "HORIZONTAL",
      children: [makeNode({ id: "c:1", name: "Child" })],
    });
    const ctx = makeContext();
    expect(noAutoLayout.check(node, ctx)).toBeNull();
  });

  it("returns null for empty frame (no children)", () => {
    const node = makeNode({ children: [] });
    const ctx = makeContext();
    expect(noAutoLayout.check(node, ctx)).toBeNull();
  });

  it("returns null for frame without children property", () => {
    const node = makeNode({});
    const ctx = makeContext();
    expect(noAutoLayout.check(node, ctx)).toBeNull();
  });

  it("flags frame without auto layout that has children", () => {
    const child = makeNode({ id: "c:1", name: "Child" });
    const node = makeNode({ name: "Container", children: [child] });
    const ctx = makeContext();

    const result = noAutoLayout.check(node, ctx);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("no-auto-layout");
    expect(result!.message).toContain("Container");
    expect(result!.message).toContain("no Auto Layout");
  });

  it("flags frame with layoutMode NONE that has children", () => {
    const child = makeNode({ id: "c:1", name: "Child" });
    const node = makeNode({
      name: "NoneLayout",
      layoutMode: "NONE",
      children: [child],
    });
    const ctx = makeContext();

    const result = noAutoLayout.check(node, ctx);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("no-auto-layout");
    expect(result!.message).toContain("NoneLayout");
  });
});
