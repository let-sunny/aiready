import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { multipleFillColors } from "./index.js";

describe("multiple-fill-colors", () => {
  it("has correct rule definition metadata", () => {
    expect(multipleFillColors.definition.id).toBe("multiple-fill-colors");
    expect(multipleFillColors.definition.category).toBe("token");
  });

  it("returns null (stub — requires cross-node analysis)", () => {
    const node = makeNode({
      fills: [
        { type: "SOLID", color: { r: 1, g: 0, b: 0 } },
        { type: "SOLID", color: { r: 0.98, g: 0.01, b: 0.01 } },
      ],
    });
    expect(multipleFillColors.check(node, makeContext())).toBeNull();
  });
});
