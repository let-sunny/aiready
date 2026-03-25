import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { imageNoPlaceholder } from "./index.js";

describe("image-no-placeholder", () => {
  it("has correct rule definition metadata", () => {
    expect(imageNoPlaceholder.definition.id).toBe("image-no-placeholder");
    expect(imageNoPlaceholder.definition.category).toBe("handoff-risk");
  });

  it("flags RECTANGLE with only IMAGE fill (no placeholder)", () => {
    const node = makeNode({
      type: "RECTANGLE",
      name: "Hero Image",
      fills: [{ type: "IMAGE", imageRef: "abc123" }],
    });
    const result = imageNoPlaceholder.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("image-no-placeholder");
    expect(result!.message).toContain("Hero Image");
  });

  it("returns null for RECTANGLE with multiple fills (has placeholder)", () => {
    const node = makeNode({
      type: "RECTANGLE",
      name: "Image",
      fills: [
        { type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } },
        { type: "IMAGE", imageRef: "abc123" },
      ],
    });
    expect(imageNoPlaceholder.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-image nodes", () => {
    const node = makeNode({ type: "FRAME" });
    expect(imageNoPlaceholder.check(node, makeContext())).toBeNull();
  });

  it("returns null for RECTANGLE with SOLID fill only", () => {
    const node = makeNode({
      type: "RECTANGLE",
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
    });
    expect(imageNoPlaceholder.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-RECTANGLE with image fill", () => {
    const node = makeNode({
      type: "FRAME",
      fills: [{ type: "IMAGE" }],
    });
    expect(imageNoPlaceholder.check(node, makeContext())).toBeNull();
  });
});
