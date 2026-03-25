import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { rawOpacity } from "./index.js";

describe("raw-opacity", () => {
  it("has correct rule definition metadata", () => {
    expect(rawOpacity.definition.id).toBe("raw-opacity");
    expect(rawOpacity.definition.category).toBe("token");
  });

  it("flags node with raw opacity", () => {
    const node = makeNode({ name: "Overlay", opacity: 0.5 });
    const result = rawOpacity.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("raw-opacity");
    expect(result!.message).toContain("50%");
  });

  it("returns null for full opacity (no opacity set)", () => {
    const node = makeNode({ name: "Solid" });
    expect(rawOpacity.check(node, makeContext())).toBeNull();
  });

  it("returns null when opacity variable is bound", () => {
    const node = makeNode({ opacity: 0.5, boundVariables: { opacity: "var-opacity-50" } });
    expect(rawOpacity.check(node, makeContext())).toBeNull();
  });
});
