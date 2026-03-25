import { RuleEngine } from "./rule-engine.js";
import type { AnalysisFile, AnalysisNode } from "../contracts/figma-node.js";

// Import rules to register
import "../rules/index.js";

function makeNode(overrides?: Partial<AnalysisNode>): AnalysisNode {
  return {
    id: "1:1",
    name: "TestNode",
    type: "FRAME",
    visible: true,
    ...overrides,
  };
}

function makeFile(overrides?: Partial<AnalysisFile>): AnalysisFile {
  return {
    fileKey: "test",
    name: "Test",
    lastModified: "",
    version: "1",
    document: makeNode({ id: "0:1", name: "Document", type: "DOCUMENT" }),
    components: {},
    styles: {},
    ...overrides,
  };
}

describe("RuleEngine.analyze — per-analysis state isolation", () => {
  it("produces identical results when called twice on the same instance", () => {
    // Two repeated frames with same name + matching component → missing-component Stage 1
    const frameA = makeNode({ id: "f:1", name: "Button" });
    const frameB = makeNode({ id: "f:2", name: "Button" });
    const doc = makeNode({
      id: "0:1",
      name: "Document",
      type: "DOCUMENT",
      children: [frameA, frameB],
    });

    const file = makeFile({
      document: doc,
      components: {
        "comp:1": { key: "comp:1", name: "Button", description: "" },
      },
    });

    const engine = new RuleEngine();

    const result1 = engine.analyze(file);
    const result2 = engine.analyze(file);

    // Both runs should find the same missing-component issue
    const missingComp1 = result1.issues.filter(
      (i) => i.violation.ruleId === "missing-component"
    );
    const missingComp2 = result2.issues.filter(
      (i) => i.violation.ruleId === "missing-component"
    );

    expect(missingComp1.length).toBeGreaterThan(0);
    expect(missingComp2.length).toBe(missingComp1.length);
    expect(missingComp2[0]?.violation.message).toBe(
      missingComp1[0]?.violation.message
    );
  });
});
