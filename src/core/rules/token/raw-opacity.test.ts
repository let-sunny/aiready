import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { rawOpacity } from "./index.js";

describe("raw-opacity", () => {
  it("has correct rule definition metadata", () => {
    expect(rawOpacity.definition.id).toBe("raw-opacity");
    expect(rawOpacity.definition.category).toBe("token");
  });

  it("returns null (stub — not yet fully implemented)", () => {
    const node = makeNode({ name: "Overlay" });
    expect(rawOpacity.check(node, makeContext())).toBeNull();
  });

  it("returns null when opacity variable is bound", () => {
    const node = makeNode({ boundVariables: { opacity: "var-opacity-50" } });
    expect(rawOpacity.check(node, makeContext())).toBeNull();
  });
});
