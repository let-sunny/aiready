import { makeNode, makeFile, makeContext } from "../test-helpers.js";
import { prototypeLinkInDesign } from "./index.js";

describe("prototype-link-in-design (missing prototype interaction)", () => {
  it("has correct rule definition metadata", () => {
    expect(prototypeLinkInDesign.definition.id).toBe("prototype-link-in-design");
    expect(prototypeLinkInDesign.definition.category).toBe("handoff-risk");
  });

  it("flags button-named element without interactions", () => {
    const node = makeNode({ type: "COMPONENT", name: "Button Primary" });
    const result = prototypeLinkInDesign.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("prototype-link-in-design");
    expect(result!.message).toContain("looks interactive");
  });

  it("flags element with interactive name patterns (FRAME and INSTANCE)", () => {
    const testCases = [
      { type: "FRAME" as const, name: "Submit Btn" },
      { type: "FRAME" as const, name: "Nav Link" },
      { type: "INSTANCE" as const, name: "Tab Item" },
      { type: "FRAME" as const, name: "CTA" },
      { type: "INSTANCE" as const, name: "Toggle Switch" },
    ];
    for (const { type, name } of testCases) {
      const node = makeNode({ type, name });
      expect(prototypeLinkInDesign.check(node, makeContext())).not.toBeNull();
    }
  });

  it("returns null for button with interactions defined", () => {
    const node = makeNode({
      type: "COMPONENT",
      name: "Button",
      interactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NAVIGATE" }] }],
    });
    expect(prototypeLinkInDesign.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-interactive names", () => {
    const node = makeNode({ type: "FRAME", name: "Card Header" });
    expect(prototypeLinkInDesign.check(node, makeContext())).toBeNull();
  });

  it("returns null for non-container/non-component nodes", () => {
    const node = makeNode({ type: "TEXT", name: "Button Label" });
    expect(prototypeLinkInDesign.check(node, makeContext())).toBeNull();
  });

  it("flags component with state variants but no interactions", () => {
    const node = makeNode({
      type: "COMPONENT",
      name: "Chip",
      componentPropertyDefinitions: {
        State: { type: "VARIANT", variantOptions: ["default", "hover", "pressed"] },
      },
    });
    const result = prototypeLinkInDesign.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.message).toContain("looks interactive");
  });

  it("returns null for container frame whose children have interactions", () => {
    const child = makeNode({
      id: "c:1",
      type: "COMPONENT",
      name: "Button",
      interactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NAVIGATE" }] }],
    });
    const container = makeNode({
      type: "FRAME",
      name: "Button Group",
      children: [child],
    });
    expect(prototypeLinkInDesign.check(container, makeContext())).toBeNull();
  });

  it("does not throw on malformed variantOptions (not an array)", () => {
    const node = makeNode({
      type: "COMPONENT",
      name: "Card",
      componentPropertyDefinitions: {
        State: { type: "VARIANT", variantOptions: "not-an-array" },
      },
    });
    // "Card" is not an interactive name, malformed variantOptions should not match
    expect(prototypeLinkInDesign.check(node, makeContext())).toBeNull();
  });

  it("does not throw on variantOptions with non-string entries", () => {
    const node = makeNode({
      type: "COMPONENT",
      name: "Button",
      componentPropertyDefinitions: {
        State: { type: "VARIANT", variantOptions: [123, null, "hover"] },
      },
    });
    const result = prototypeLinkInDesign.check(node, makeContext());
    // "hover" matches STATE_VARIANT_PATTERNS, so should flag (no interactions)
    expect(result).not.toBeNull();
  });

  it("returns null for component with non-state variants", () => {
    const node = makeNode({
      type: "COMPONENT",
      name: "Icon",
      componentPropertyDefinitions: {
        Size: { type: "VARIANT", variantOptions: ["small", "medium", "large"] },
      },
    });
    expect(prototypeLinkInDesign.check(node, makeContext())).toBeNull();
  });
});
