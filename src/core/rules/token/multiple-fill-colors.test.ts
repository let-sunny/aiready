import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { multipleFillColors } from "./index.js";

function solidFill(r: number, g: number, b: number) {
  return { type: "SOLID", color: { r: r / 255, g: g / 255, b: b / 255, a: 1 } };
}

describe("multiple-fill-colors", () => {
  it("has correct rule definition metadata", () => {
    expect(multipleFillColors.definition.id).toBe("multiple-fill-colors");
    expect(multipleFillColors.definition.category).toBe("token");
  });

  it("flags near-duplicate colors across siblings", () => {
    const nodeA = makeNode({ id: "a:1", name: "CardA", fills: [solidFill(59, 130, 246)] });
    const nodeB = makeNode({ id: "b:1", name: "CardB", fills: [solidFill(59, 129, 246)] }); // 1 off in green
    const siblings = [nodeA, nodeB];

    const result = multipleFillColors.check(nodeA, makeContext({ siblings }));
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("multiple-fill-colors");
    expect(result!.message).toContain("near-duplicate");
  });

  it("returns null for identical colors", () => {
    const nodeA = makeNode({ id: "a:1", fills: [solidFill(59, 130, 246)] });
    const nodeB = makeNode({ id: "b:1", fills: [solidFill(59, 130, 246)] });
    const siblings = [nodeA, nodeB];

    expect(multipleFillColors.check(nodeA, makeContext({ siblings }))).toBeNull();
  });

  it("returns null for very different colors", () => {
    const nodeA = makeNode({ id: "a:1", fills: [solidFill(59, 130, 246)] });
    const nodeB = makeNode({ id: "b:1", fills: [solidFill(255, 0, 0)] }); // red vs blue
    const siblings = [nodeA, nodeB];

    expect(multipleFillColors.check(nodeA, makeContext({ siblings }))).toBeNull();
  });

  it("returns null when node has no fills", () => {
    const nodeA = makeNode({ id: "a:1" });
    const nodeB = makeNode({ id: "b:1", fills: [solidFill(59, 130, 246)] });
    expect(multipleFillColors.check(nodeA, makeContext({ siblings: [nodeA, nodeB] }))).toBeNull();
  });

  it("returns null when node has fill style (tokenized)", () => {
    const nodeA = makeNode({ id: "a:1", fills: [solidFill(59, 130, 246)], styles: { fill: "style-1" } });
    const nodeB = makeNode({ id: "b:1", fills: [solidFill(59, 129, 246)] });
    expect(multipleFillColors.check(nodeA, makeContext({ siblings: [nodeA, nodeB] }))).toBeNull();
  });

  it("returns null without siblings", () => {
    const node = makeNode({ fills: [solidFill(59, 130, 246)] });
    expect(multipleFillColors.check(node, makeContext())).toBeNull();
  });

  it("respects default tolerance", () => {
    const nodeA = makeNode({ id: "a:1", fills: [solidFill(100, 100, 100)] });
    const nodeB = makeNode({ id: "b:1", fills: [solidFill(105, 100, 100)] }); // distance ~5
    const siblings = [nodeA, nodeB];

    // Default tolerance 10 → should flag (distance 5 < 10)
    expect(multipleFillColors.check(nodeA, makeContext({ siblings }))).not.toBeNull();
  });

  it("respects custom tolerance via options", () => {
    const nodeA = makeNode({ id: "a:1", fills: [solidFill(100, 100, 100)] });
    const nodeB = makeNode({ id: "b:1", fills: [solidFill(105, 100, 100)] }); // distance ~5
    const siblings = [nodeA, nodeB];

    // Custom tolerance 3 → distance 5 exceeds it, should NOT flag
    expect(multipleFillColors.check(nodeA, makeContext({ siblings }), { tolerance: 3 })).toBeNull();

    // Custom tolerance 10 → distance 5 within it, should flag
    expect(multipleFillColors.check(nodeA, makeContext({ siblings }), { tolerance: 10 })).not.toBeNull();
  });
});
