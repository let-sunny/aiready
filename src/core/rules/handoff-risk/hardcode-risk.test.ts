import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { hardcodeRisk } from "./index.js";

describe("hardcode-risk", () => {
  it("has correct rule definition metadata", () => {
    expect(hardcodeRisk.definition.id).toBe("hardcode-risk");
    expect(hardcodeRisk.definition.category).toBe("handoff-risk");
  });

  it("flags container with absolute positioning in auto layout parent", () => {
    const parent = makeNode({ layoutMode: "VERTICAL" });
    const node = makeNode({
      type: "FRAME",
      name: "FloatingPanel",
      layoutPositioning: "ABSOLUTE",
    });
    const result = hardcodeRisk.check(node, makeContext({ parent }));
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("hardcode-risk");
    expect(result!.message).toContain("FloatingPanel");
  });

  it("returns null for non-container nodes", () => {
    const parent = makeNode({ layoutMode: "VERTICAL" });
    const node = makeNode({ type: "TEXT", layoutPositioning: "ABSOLUTE" });
    expect(hardcodeRisk.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null when not using absolute positioning", () => {
    const parent = makeNode({ layoutMode: "VERTICAL" });
    const node = makeNode({ type: "FRAME" });
    expect(hardcodeRisk.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null when parent has no auto layout", () => {
    const parent = makeNode({});
    const node = makeNode({ type: "FRAME", layoutPositioning: "ABSOLUTE" });
    expect(hardcodeRisk.check(node, makeContext({ parent }))).toBeNull();
  });

  it("returns null when no parent", () => {
    const node = makeNode({ type: "FRAME", layoutPositioning: "ABSOLUTE" });
    expect(hardcodeRisk.check(node, makeContext())).toBeNull();
  });
});
