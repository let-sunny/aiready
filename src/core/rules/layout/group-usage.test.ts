import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { groupUsage } from "./index.js";

describe("group-usage", () => {
  it("has correct rule definition metadata", () => {
    expect(groupUsage.definition.id).toBe("group-usage");
    expect(groupUsage.definition.category).toBe("layout");
  });

  it("flags GROUP nodes", () => {
    const node = makeNode({ type: "GROUP", name: "My Group" });
    const result = groupUsage.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("group-usage");
    expect(result!.message).toContain("My Group");
  });

  it("returns null for FRAME nodes", () => {
    const node = makeNode({ type: "FRAME" });
    expect(groupUsage.check(node, makeContext())).toBeNull();
  });

  it("returns null for COMPONENT nodes", () => {
    const node = makeNode({ type: "COMPONENT" });
    expect(groupUsage.check(node, makeContext())).toBeNull();
  });

  it("returns null for TEXT nodes", () => {
    const node = makeNode({ type: "TEXT" });
    expect(groupUsage.check(node, makeContext())).toBeNull();
  });
});
