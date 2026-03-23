import { analyzeFile } from "../../engine/rule-engine.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";

// Import rules to register
import "../index.js";

function makeNode(overrides: Partial<AnalysisNode> & { name: string; type: string }): AnalysisNode {
  return {
    id: overrides.id ?? overrides.name,
    visible: true,
    ...overrides,
  } as AnalysisNode;
}

function makeFile(document: AnalysisNode): AnalysisFile {
  return {
    fileKey: "test",
    name: "Test",
    lastModified: "",
    version: "1",
    document,
    components: {},
    styles: {},
  };
}

describe("deep-nesting rule (componentDepth)", () => {
  it("does not flag shallow nesting", () => {
    const file = makeFile(
      makeNode({
        name: "Root", type: "FRAME",
        children: [
          makeNode({
            name: "Level1", type: "FRAME",
            children: [
              makeNode({ name: "Level2", type: "FRAME" }),
            ],
          }),
        ],
      })
    );
    const result = analyzeFile(file);
    const deepNestingIssues = result.issues.filter(i => i.rule.definition.id === "deep-nesting");
    expect(deepNestingIssues).toHaveLength(0);
  });

  it("flags deeply nested nodes (6+ levels)", () => {
    // Build 7-level deep nesting without component boundaries
    let deepest = makeNode({ name: "Level6", type: "FRAME" });
    let current = deepest;
    for (let i = 5; i >= 0; i--) {
      current = makeNode({
        name: `Level${i}`, type: "FRAME",
        children: [current],
      });
    }

    const file = makeFile(current);
    const result = analyzeFile(file);
    const deepNestingIssues = result.issues.filter(i => i.rule.definition.id === "deep-nesting");
    expect(deepNestingIssues.length).toBeGreaterThan(0);
  });

  it("resets depth at INSTANCE boundary", () => {
    // 3 levels FRAME → INSTANCE → 3 levels FRAME = componentDepth max 3 (not 6)
    const file = makeFile(
      makeNode({
        name: "Root", type: "FRAME",
        children: [
          makeNode({
            name: "L1", type: "FRAME",
            children: [
              makeNode({
                name: "L2", type: "FRAME",
                children: [
                  makeNode({
                    name: "MyInstance", type: "INSTANCE",
                    children: [
                      makeNode({
                        name: "Inner1", type: "FRAME",
                        children: [
                          makeNode({
                            name: "Inner2", type: "FRAME",
                            children: [
                              makeNode({ name: "Inner3", type: "FRAME" }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    const result = analyzeFile(file);
    const deepNestingIssues = result.issues.filter(i => i.rule.definition.id === "deep-nesting");
    // componentDepth resets at INSTANCE, so Inner3 is only componentDepth 3, not 6
    expect(deepNestingIssues).toHaveLength(0);
  });

  it("resets depth at COMPONENT boundary", () => {
    // 4 levels → COMPONENT → 4 levels = componentDepth max 4
    let inner = makeNode({ name: "Deep4", type: "FRAME" });
    for (let i = 3; i >= 1; i--) {
      inner = makeNode({ name: `Deep${i}`, type: "FRAME", children: [inner] });
    }

    let outer: AnalysisNode = makeNode({ name: "MyComponent", type: "COMPONENT", children: [inner] });
    for (let i = 3; i >= 0; i--) {
      outer = makeNode({ name: `Outer${i}`, type: "FRAME", children: [outer] });
    }

    const file = makeFile(outer);
    const result = analyzeFile(file);
    const deepNestingIssues = result.issues.filter(i => i.rule.definition.id === "deep-nesting");
    // max componentDepth is 4 (inside component), threshold is 5 → no flag
    expect(deepNestingIssues).toHaveLength(0);
  });

  it("flags deep nesting within a component", () => {
    // COMPONENT → 6 levels deep = componentDepth 6, threshold 5 → flag
    let inner = makeNode({ name: "VeryDeep", type: "FRAME" });
    for (let i = 5; i >= 1; i--) {
      inner = makeNode({ name: `Level${i}`, type: "FRAME", children: [inner] });
    }

    const file = makeFile(
      makeNode({
        name: "MyComponent", type: "COMPONENT",
        children: [inner],
      })
    );

    const result = analyzeFile(file);
    const deepNestingIssues = result.issues.filter(i => i.rule.definition.id === "deep-nesting");
    expect(deepNestingIssues.length).toBeGreaterThan(0);
    expect(deepNestingIssues[0]!.violation.message).toContain("within its component");
  });

  it("rule is in handoff-risk category", () => {
    const file = makeFile(makeNode({ name: "Root", type: "FRAME" }));
    const result = analyzeFile(file);
    // Check rule registry
    const rules = result.issues.map(i => i.rule.definition);
    // Even if no issues, we can verify from a flagged case
    let inner = makeNode({ name: "Deep", type: "FRAME" });
    for (let i = 5; i >= 0; i--) {
      inner = makeNode({ name: `L${i}`, type: "FRAME", children: [inner] });
    }
    const file2 = makeFile(inner);
    const result2 = analyzeFile(file2);
    const issue = result2.issues.find(i => i.rule.definition.id === "deep-nesting");
    expect(issue?.rule.definition.category).toBe("handoff-risk");
  });
});
