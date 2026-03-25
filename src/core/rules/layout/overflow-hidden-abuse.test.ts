import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { overflowHiddenAbuse } from "./index.js";

describe("overflow-hidden-abuse", () => {
  it("has correct rule definition metadata", () => {
    expect(overflowHiddenAbuse.definition.id).toBe("overflow-hidden-abuse");
    expect(overflowHiddenAbuse.definition.category).toBe("layout");
  });

  it("returns null (stub implementation)", () => {
    const node = makeNode({ type: "FRAME", clipsContent: true });
    expect(overflowHiddenAbuse.check(node, makeContext())).toBeNull();
  });
});
