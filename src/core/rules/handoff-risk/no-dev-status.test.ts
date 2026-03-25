import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { noDevStatus } from "./index.js";

describe("no-dev-status", () => {
  it("has correct rule definition metadata", () => {
    expect(noDevStatus.definition.id).toBe("no-dev-status");
    expect(noDevStatus.definition.category).toBe("handoff-risk");
  });

  it("flags top-level frame without devStatus", () => {
    const node = makeNode({ type: "FRAME", name: "LoginScreen" });
    const result = noDevStatus.check(node, makeContext({ depth: 1 }));
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("no-dev-status");
    expect(result!.message).toContain("LoginScreen");
  });

  it("returns null when devStatus is set", () => {
    const node = makeNode({
      type: "FRAME",
      name: "LoginScreen",
      devStatus: { type: "READY_FOR_DEV" },
    });
    expect(noDevStatus.check(node, makeContext({ depth: 1 }))).toBeNull();
  });

  it("returns null for nested frames (depth > 1)", () => {
    const node = makeNode({ type: "FRAME", name: "Card" });
    expect(noDevStatus.check(node, makeContext({ depth: 2 }))).toBeNull();
  });

  it("returns null for non-FRAME nodes", () => {
    const node = makeNode({ type: "GROUP" });
    expect(noDevStatus.check(node, makeContext({ depth: 1 }))).toBeNull();
  });
});
