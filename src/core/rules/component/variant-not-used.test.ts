import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { variantNotUsed } from "./index.js";

describe("variant-not-used", () => {
  it("has correct rule definition metadata", () => {
    expect(variantNotUsed.definition.id).toBe("variant-not-used");
    expect(variantNotUsed.definition.category).toBe("component");
  });

  it("returns null (stub — requires component variant context)", () => {
    const node = makeNode({ type: "INSTANCE", componentId: "comp-1" });
    expect(variantNotUsed.check(node, makeContext())).toBeNull();
  });
});
