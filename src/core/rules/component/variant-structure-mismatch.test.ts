import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { variantStructureMismatch } from "./index.js";

describe("variant-structure-mismatch", () => {
  it("has correct rule definition metadata", () => {
    expect(variantStructureMismatch.definition.id).toBe("variant-structure-mismatch");
    expect(variantStructureMismatch.definition.category).toBe("component");
  });

  it("flags COMPONENT_SET with mismatched variant structures", () => {
    const variantA = makeNode({
      id: "v:1",
      type: "COMPONENT",
      name: "Default",
      children: [
        makeNode({ id: "v1c:1", type: "TEXT", name: "Label" }),
      ],
    });
    const variantB = makeNode({
      id: "v:2",
      type: "COMPONENT",
      name: "WithIcon",
      children: [
        makeNode({ id: "v2c:1", type: "FRAME", name: "Icon" }),
        makeNode({ id: "v2c:2", type: "TEXT", name: "Label" }),
      ],
    });
    const node = makeNode({
      type: "COMPONENT_SET",
      name: "Button",
      children: [variantA, variantB],
    });

    const result = variantStructureMismatch.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("variant-structure-mismatch");
    expect(result!.message).toContain("Button");
    expect(result!.message).toContain("1/2");
  });

  it("returns null when all variants have same structure", () => {
    const variantA = makeNode({
      id: "v:1",
      type: "COMPONENT",
      name: "Default",
      children: [
        makeNode({ id: "v1c:1", type: "TEXT", name: "Label" }),
      ],
    });
    const variantB = makeNode({
      id: "v:2",
      type: "COMPONENT",
      name: "Hover",
      children: [
        makeNode({ id: "v2c:1", type: "TEXT", name: "Label" }),
      ],
    });
    const node = makeNode({
      type: "COMPONENT_SET",
      name: "Button",
      children: [variantA, variantB],
    });

    expect(variantStructureMismatch.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-COMPONENT_SET nodes", () => {
    const node = makeNode({ type: "FRAME" });
    expect(variantStructureMismatch.check(node, makeContext())).toBeNull();
  });

  it("returns null with fewer than 2 children", () => {
    const variant = makeNode({
      id: "v:1",
      type: "COMPONENT",
      name: "Only",
      children: [makeNode({ id: "c:1", type: "TEXT" })],
    });
    const node = makeNode({
      type: "COMPONENT_SET",
      name: "Single",
      children: [variant],
    });

    expect(variantStructureMismatch.check(node, makeContext())).toBeNull();
  });

  it("returns null for empty COMPONENT_SET", () => {
    const node = makeNode({
      type: "COMPONENT_SET",
      name: "Empty",
    });
    expect(variantStructureMismatch.check(node, makeContext())).toBeNull();
  });
});
