import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { missingComponentDescription } from "./index.js";

// ============================================
// Test helpers
// ============================================

function makeNode(overrides?: Partial<AnalysisNode>): AnalysisNode {
  return {
    id: "1:1",
    name: "TestNode",
    type: "INSTANCE",
    visible: true,
    ...overrides,
  };
}

function makeFile(
  components: AnalysisFile["components"] = {}
): AnalysisFile {
  return {
    fileKey: "test-file",
    name: "Test File",
    lastModified: "2026-01-01T00:00:00Z",
    version: "1",
    document: makeNode({ id: "0:1", name: "Document", type: "DOCUMENT" }),
    components,
    styles: {},
  };
}

/** Each test gets a fresh analysisState to isolate dedup state */
let analysisState: Map<string, unknown>;

function makeContext(overrides?: Partial<RuleContext>): RuleContext {
  return {
    file: makeFile(),
    depth: 2,
    componentDepth: 0,
    maxDepth: 10,
    path: ["Page", "Frame"],
    analysisState,
    ...overrides,
  };
}

// ============================================
// missing-component-description
// ============================================

describe("missing-component-description", () => {
  beforeEach(() => {
    analysisState = new Map();
  });

  it("returns null for non-INSTANCE nodes", () => {
    const ctx = makeContext({
      file: makeFile({
        "comp:1": { key: "comp:1", name: "Button", description: "" },
      }),
    });

    expect(
      missingComponentDescription.check(makeNode({ type: "FRAME" }), ctx)
    ).toBeNull();
    expect(
      missingComponentDescription.check(makeNode({ type: "COMPONENT" }), ctx)
    ).toBeNull();
    expect(
      missingComponentDescription.check(makeNode({ type: "TEXT" }), ctx)
    ).toBeNull();
  });

  it("returns null when INSTANCE has no componentId", () => {
    const ctx = makeContext({
      file: makeFile({
        "comp:1": { key: "comp:1", name: "Button", description: "" },
      }),
    });

    expect(
      missingComponentDescription.check(
        makeNode({ type: "INSTANCE" }),
        ctx
      )
    ).toBeNull();
  });

  it("returns null when componentId is not found in file.components", () => {
    const ctx = makeContext({
      file: makeFile({}),
    });

    expect(
      missingComponentDescription.check(
        makeNode({ type: "INSTANCE", componentId: "comp:999" }),
        ctx
      )
    ).toBeNull();
  });

  it("returns null when component has a non-empty description", () => {
    const ctx = makeContext({
      file: makeFile({
        "comp:1": {
          key: "comp:1",
          name: "Button",
          description: "A primary action button",
        },
      }),
    });

    expect(
      missingComponentDescription.check(
        makeNode({ type: "INSTANCE", componentId: "comp:1" }),
        ctx
      )
    ).toBeNull();
  });

  it("returns null when component has a whitespace-only description", () => {
    const ctx = makeContext({
      file: makeFile({
        "comp:1": {
          key: "comp:1",
          name: "Button",
          description: "   ",
        },
      }),
    });

    // Whitespace-only is treated as empty — should flag, not skip
    const result = missingComponentDescription.check(
      makeNode({ type: "INSTANCE", componentId: "comp:1" }),
      ctx
    );
    expect(result).not.toBeNull();
  });

  it("flags INSTANCE node whose component has an empty description", () => {
    const ctx = makeContext({
      file: makeFile({
        "comp:1": { key: "comp:1", name: "Button", description: "" },
      }),
    });

    const result = missingComponentDescription.check(
      makeNode({ id: "inst:1", type: "INSTANCE", componentId: "comp:1" }),
      ctx
    );

    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("missing-component-description");
    expect(result!.nodeId).toBe("inst:1");
    expect(result!.message).toContain("Button");
    expect(result!.message).toContain("no description");
  });

  it("includes the component name in the message", () => {
    const ctx = makeContext({
      file: makeFile({
        "comp:42": { key: "comp:42", name: "Icon/Close", description: "" },
      }),
    });

    const result = missingComponentDescription.check(
      makeNode({ type: "INSTANCE", componentId: "comp:42" }),
      ctx
    );

    expect(result).not.toBeNull();
    expect(result!.message).toContain("Icon/Close");
  });

  it("includes the node path in the violation", () => {
    const ctx = makeContext({
      file: makeFile({
        "comp:1": { key: "comp:1", name: "Button", description: "" },
      }),
      path: ["Page", "Section", "Card"],
    });

    const result = missingComponentDescription.check(
      makeNode({ type: "INSTANCE", componentId: "comp:1" }),
      ctx
    );

    expect(result).not.toBeNull();
    expect(result!.nodePath).toBe("Page > Section > Card");
  });

  it("deduplicates: flags only once per unique componentId", () => {
    const ctx = makeContext({
      file: makeFile({
        "comp:1": { key: "comp:1", name: "Button", description: "" },
      }),
    });

    const first = missingComponentDescription.check(
      makeNode({ id: "inst:1", type: "INSTANCE", componentId: "comp:1" }),
      ctx
    );
    const second = missingComponentDescription.check(
      makeNode({ id: "inst:2", type: "INSTANCE", componentId: "comp:1" }),
      ctx
    );
    const third = missingComponentDescription.check(
      makeNode({ id: "inst:3", type: "INSTANCE", componentId: "comp:1" }),
      ctx
    );

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(third).toBeNull();
  });

  it("flags different components independently", () => {
    const ctx = makeContext({
      file: makeFile({
        "comp:1": { key: "comp:1", name: "Button", description: "" },
        "comp:2": { key: "comp:2", name: "Input", description: "" },
      }),
    });

    const result1 = missingComponentDescription.check(
      makeNode({ id: "inst:1", type: "INSTANCE", componentId: "comp:1" }),
      ctx
    );
    const result2 = missingComponentDescription.check(
      makeNode({ id: "inst:2", type: "INSTANCE", componentId: "comp:2" }),
      ctx
    );

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1!.message).toContain("Button");
    expect(result2!.message).toContain("Input");
  });

  it("fresh analysisState clears dedup state between analysis runs", () => {
    const ctx = makeContext({
      file: makeFile({
        "comp:1": { key: "comp:1", name: "Button", description: "" },
      }),
    });

    const first = missingComponentDescription.check(
      makeNode({ id: "inst:1", type: "INSTANCE", componentId: "comp:1" }),
      ctx
    );
    expect(first).not.toBeNull();

    // Fresh analysisState simulates a new analysis run — should flag again
    analysisState = new Map();
    const freshCtx = makeContext({
      file: makeFile({
        "comp:1": { key: "comp:1", name: "Button", description: "" },
      }),
    });

    const second = missingComponentDescription.check(
      makeNode({ id: "inst:1", type: "INSTANCE", componentId: "comp:1" }),
      freshCtx
    );
    expect(second).not.toBeNull();
  });

  it("has correct rule definition metadata", () => {
    const def = missingComponentDescription.definition;
    expect(def.id).toBe("missing-component-description");
    expect(def.category).toBe("component");
    expect(def.why).toBeTruthy();
    expect(def.impact).toBeTruthy();
    expect(def.fix).toBeTruthy();
  });
});
