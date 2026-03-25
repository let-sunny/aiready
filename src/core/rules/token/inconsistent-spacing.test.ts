import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { inconsistentSpacing } from "./index.js";

describe("inconsistent-spacing", () => {
  it("has correct rule definition metadata", () => {
    expect(inconsistentSpacing.definition.id).toBe("inconsistent-spacing");
    expect(inconsistentSpacing.definition.category).toBe("token");
  });

  it("flags padding not on 4pt grid", () => {
    const node = makeNode({ name: "Card", paddingLeft: 5 });
    const result = inconsistentSpacing.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("inconsistent-spacing");
    expect(result!.message).toContain("5");
  });

  it("flags itemSpacing not on 4pt grid", () => {
    const node = makeNode({ name: "List", itemSpacing: 7 });
    const result = inconsistentSpacing.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.message).toContain("7");
  });

  it("returns null for grid-aligned padding", () => {
    const node = makeNode({ paddingLeft: 8, paddingTop: 12 });
    expect(inconsistentSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null for grid-aligned itemSpacing", () => {
    const node = makeNode({ itemSpacing: 16 });
    expect(inconsistentSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null when no spacing values", () => {
    const node = makeNode({});
    expect(inconsistentSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null for zero padding", () => {
    const node = makeNode({ paddingLeft: 0 });
    expect(inconsistentSpacing.check(node, makeContext())).toBeNull();
  });

  it("respects custom gridBase option", () => {
    const node = makeNode({ paddingLeft: 6 });
    expect(inconsistentSpacing.check(node, makeContext(), { gridBase: 3 })).toBeNull();
  });
});
