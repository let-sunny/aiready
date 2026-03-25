import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { prototypeLinkInDesign } from "./index.js";

describe("prototype-link-in-design", () => {
  it("has correct rule definition metadata", () => {
    expect(prototypeLinkInDesign.definition.id).toBe("prototype-link-in-design");
    expect(prototypeLinkInDesign.definition.category).toBe("handoff-risk");
  });

  it("returns null (stub — requires prototype/interaction data)", () => {
    const node = makeNode({ type: "FRAME", name: "Button" });
    expect(prototypeLinkInDesign.check(node, makeContext())).toBeNull();
  });
});
