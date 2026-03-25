import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { rawFont } from "./index.js";

describe("raw-font", () => {
  it("has correct rule definition metadata", () => {
    expect(rawFont.definition.id).toBe("raw-font");
    expect(rawFont.definition.category).toBe("token");
  });

  it("returns null for non-TEXT nodes", () => {
    const node = makeNode({ type: "FRAME" });
    expect(rawFont.check(node, makeContext())).toBeNull();
  });

  it("returns null when text style is applied", () => {
    const node = makeNode({
      type: "TEXT",
      name: "Label",
      styles: { text: "style-123" },
    });
    expect(rawFont.check(node, makeContext())).toBeNull();
  });

  it("returns null when fontFamily variable is bound", () => {
    const node = makeNode({
      type: "TEXT",
      name: "Label",
      boundVariables: { fontFamily: "var-123" },
    });
    expect(rawFont.check(node, makeContext())).toBeNull();
  });

  it("returns null when fontSize variable is bound", () => {
    const node = makeNode({
      type: "TEXT",
      name: "Label",
      boundVariables: { fontSize: "var-456" },
    });
    expect(rawFont.check(node, makeContext())).toBeNull();
  });

  it("flags TEXT node without any text style or variable", () => {
    const node = makeNode({ type: "TEXT", name: "Unstyled Label" });
    const result = rawFont.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("raw-font");
    expect(result!.message).toContain("Unstyled Label");
  });
});
