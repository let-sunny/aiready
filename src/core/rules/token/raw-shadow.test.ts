import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { rawShadow } from "./index.js";

describe("raw-shadow", () => {
  it("has correct rule definition metadata", () => {
    expect(rawShadow.definition.id).toBe("raw-shadow");
    expect(rawShadow.definition.category).toBe("token");
  });

  it("flags DROP_SHADOW without effect style", () => {
    const node = makeNode({
      name: "Card",
      effects: [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.25 } }],
    });
    const result = rawShadow.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("raw-shadow");
    expect(result!.message).toContain("Card");
  });

  it("flags INNER_SHADOW without effect style", () => {
    const node = makeNode({
      name: "Input",
      effects: [{ type: "INNER_SHADOW" }],
    });
    const result = rawShadow.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("raw-shadow");
  });

  it("returns null when effect style is applied", () => {
    const node = makeNode({
      effects: [{ type: "DROP_SHADOW" }],
      styles: { effect: "style-shadow-1" },
    });
    expect(rawShadow.check(node, makeContext())).toBeNull();
  });

  it("returns null when no effects", () => {
    const node = makeNode({});
    expect(rawShadow.check(node, makeContext())).toBeNull();
  });

  it("returns null when effects array is empty", () => {
    const node = makeNode({ effects: [] });
    expect(rawShadow.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-shadow effects (e.g. LAYER_BLUR)", () => {
    const node = makeNode({ effects: [{ type: "LAYER_BLUR" }] });
    expect(rawShadow.check(node, makeContext())).toBeNull();
  });
});
