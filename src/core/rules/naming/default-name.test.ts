import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { defaultName } from "./index.js";

describe("default-name", () => {
  it("has correct rule definition metadata", () => {
    expect(defaultName.definition.id).toBe("default-name");
    expect(defaultName.definition.category).toBe("minor");
  });

  it.each([
    "Frame 1",
    "Frame",
    "Group 12",
    "Ellipse",
    "Vector 1",
    "Line 5",
    "Text 2",
    "Component 1",
    "Instance 3",
  ])("flags default name: %s", (name) => {
    const node = makeNode({ name });
    const result = defaultName.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("default-name");
  });

  it("returns null for semantic names", () => {
    const node = makeNode({ name: "ProductCard" });
    expect(defaultName.check(node, makeContext())).toBeNull();
  });

  it("returns null for excluded name patterns", () => {
    const node = makeNode({ name: "Icon Badge" });
    expect(defaultName.check(node, makeContext())).toBeNull();
  });

  it("returns null when name is empty", () => {
    const node = makeNode({ name: "" });
    expect(defaultName.check(node, makeContext())).toBeNull();
  });
});
