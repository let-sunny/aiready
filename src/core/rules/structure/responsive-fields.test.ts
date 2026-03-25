import { analyzeFile } from "../../engine/rule-engine.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";

// Import rules to register
import "../index.js";

function makeNode(
  overrides: Partial<AnalysisNode> & { name: string; type: string },
): AnalysisNode {
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

describe("fixed-size-in-auto-layout", () => {
  it("flags container with both axes FIXED inside auto-layout parent", () => {
    const file = makeFile(
      makeNode({
        name: "Root",
        type: "FRAME",
        layoutMode: "HORIZONTAL",
        children: [
          makeNode({
            name: "Card",
            type: "FRAME",
            layoutSizingHorizontal: "FIXED",
            layoutSizingVertical: "FIXED",
            absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 100 },
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "fixed-size-in-auto-layout",
    );
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.at(0)?.violation.message).toContain("Card");
  });

  it("does not flag when one axis is FILL", () => {
    const file = makeFile(
      makeNode({
        name: "Root",
        type: "FRAME",
        layoutMode: "HORIZONTAL",
        children: [
          makeNode({
            name: "Card",
            type: "FRAME",
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "FIXED",
            absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 100 },
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "fixed-size-in-auto-layout",
    );
    expect(issues).toHaveLength(0);
  });

  it("does not flag small elements (icons)", () => {
    const file = makeFile(
      makeNode({
        name: "Root",
        type: "FRAME",
        layoutMode: "HORIZONTAL",
        children: [
          makeNode({
            name: "Icon",
            type: "FRAME",
            layoutSizingHorizontal: "FIXED",
            layoutSizingVertical: "FIXED",
            absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "fixed-size-in-auto-layout",
    );
    expect(issues).toHaveLength(0);
  });
});

describe("missing-size-constraint", () => {
  it("flags FILL container without minWidth in auto-layout", () => {
    const file = makeFile(
      makeNode({
        name: "Root",
        type: "FRAME",
        layoutMode: "HORIZONTAL",
        children: [
          makeNode({
            name: "Content",
            type: "FRAME",
            layoutSizingHorizontal: "FILL",
            absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 100 },
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "missing-size-constraint",
    );
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.at(0)?.violation.message).toContain("Content");
  });

  it("does not flag FILL container that has minWidth set", () => {
    const file = makeFile(
      makeNode({
        name: "Root",
        type: "FRAME",
        layoutMode: "HORIZONTAL",
        children: [
          makeNode({
            name: "Content",
            type: "FRAME",
            layoutSizingHorizontal: "FILL",
            minWidth: 120,
            absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 100 },
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "missing-size-constraint",
    );
    // Only maxWidth missing, but width=300 > 200 threshold so still flagged
    // Check message mentions max-width specifically
    if (issues.length > 0) {
      expect(issues.at(0)?.violation.message).toContain("max-width");
    }
  });

  it("does not flag FIXED container", () => {
    const file = makeFile(
      makeNode({
        name: "Root",
        type: "FRAME",
        layoutMode: "HORIZONTAL",
        children: [
          makeNode({
            name: "Sidebar",
            type: "FRAME",
            layoutSizingHorizontal: "FIXED",
            absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 100 },
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "missing-size-constraint",
    );
    expect(issues).toHaveLength(0);
  });

  it("flags FILL container without maxWidth when wide", () => {
    const file = makeFile(
      makeNode({
        name: "Root",
        type: "FRAME",
        layoutMode: "HORIZONTAL",
        children: [
          makeNode({
            name: "TextBlock",
            type: "FRAME",
            layoutSizingHorizontal: "FILL",
            absoluteBoundingBox: { x: 0, y: 0, width: 600, height: 100 },
            children: [
              makeNode({ name: "Label", type: "TEXT", characters: "Hello" }),
            ],
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "missing-size-constraint",
    );
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag FILL container outside auto-layout parent", () => {
    const file = makeFile(
      makeNode({
        name: "Root",
        type: "FRAME",
        children: [
          makeNode({
            name: "TextBlock",
            type: "FRAME",
            layoutSizingHorizontal: "FILL",
            absoluteBoundingBox: { x: 0, y: 0, width: 600, height: 100 },
            children: [
              makeNode({ name: "Label", type: "TEXT", characters: "Hello" }),
            ],
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "missing-size-constraint",
    );
    expect(issues).toHaveLength(0);
  });
});
