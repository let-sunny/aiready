import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { magicNumberSpacing } from "./index.js";

describe("magic-number-spacing", () => {
  it("has correct rule definition metadata", () => {
    expect(magicNumberSpacing.definition.id).toBe("magic-number-spacing");
    expect(magicNumberSpacing.definition.category).toBe("token");
  });

  it("flags odd magic number padding (e.g. 13px)", () => {
    const node = makeNode({ name: "Card", paddingLeft: 13 });
    const result = magicNumberSpacing.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("magic-number-spacing");
    expect(result!.message).toContain("13");
  });

  it("flags odd magic number itemSpacing (e.g. 17px)", () => {
    const node = makeNode({ name: "List", itemSpacing: 17 });
    const result = magicNumberSpacing.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.message).toContain("17");
  });

  it("returns null for grid-aligned spacing (e.g. 8px on 4pt grid)", () => {
    const node = makeNode({ paddingLeft: 8, paddingTop: 16 });
    expect(magicNumberSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null for small intentional values (1, 2, 4)", () => {
    const node = makeNode({ paddingLeft: 1 });
    expect(magicNumberSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null for even off-grid values (e.g. 6px)", () => {
    const node = makeNode({ paddingLeft: 6 });
    expect(magicNumberSpacing.check(node, makeContext())).toBeNull();
  });

  it("returns null when no spacing values exist", () => {
    const node = makeNode({});
    expect(magicNumberSpacing.check(node, makeContext())).toBeNull();
  });

  it("respects custom gridBase option", () => {
    const node = makeNode({ name: "Card", paddingLeft: 9 });
    expect(magicNumberSpacing.check(node, makeContext(), { gridBase: 3 })).toBeNull();
  });
});
