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
  it("flags FILL container when siblings have mixed sizing", () => {
    const file = makeFile(
      makeNode({
        name: "Page",
        type: "FRAME",
        children: [
          makeNode({
            name: "Root",
            type: "FRAME",
            layoutMode: "HORIZONTAL",
            children: [
              makeNode({
                name: "Sidebar",
                type: "FRAME",
                layoutSizingHorizontal: "FIXED",
                absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 100 },
              }),
              makeNode({
                name: "Content",
                type: "FRAME",
                layoutSizingHorizontal: "FILL",
                absoluteBoundingBox: { x: 200, y: 0, width: 400, height: 100 },
              }),
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

  it("does not flag when maxWidth is set", () => {
    const file = makeFile(
      makeNode({
        name: "Page",
        type: "FRAME",
        children: [
          makeNode({
            name: "Root",
            type: "FRAME",
            layoutMode: "HORIZONTAL",
            children: [
              makeNode({
                name: "Left",
                type: "FRAME",
                layoutSizingHorizontal: "FILL",
                maxWidth: 800,
                absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 100 },
              }),
              makeNode({
                name: "Right",
                type: "FRAME",
                layoutSizingHorizontal: "FILL",
                absoluteBoundingBox: { x: 300, y: 0, width: 300, height: 100 },
              }),
            ],
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "missing-size-constraint" && i.violation.nodeId === "Left",
    );
    expect(issues).toHaveLength(0);
  });

  it("flags when all siblings are FILL (max-width still needed)", () => {
    const file = makeFile(
      makeNode({
        name: "Page",
        type: "FRAME",
        children: [
          makeNode({
            name: "Root",
            type: "FRAME",
            layoutMode: "VERTICAL",
            children: [
              makeNode({
                name: "Item1",
                type: "FRAME",
                layoutSizingHorizontal: "FILL",
                absoluteBoundingBox: { x: 0, y: 0, width: 600, height: 50 },
              }),
              makeNode({
                name: "Item2",
                type: "FRAME",
                layoutSizingHorizontal: "FILL",
                absoluteBoundingBox: { x: 0, y: 50, width: 600, height: 50 },
              }),
            ],
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "missing-size-constraint",
    );
    expect(issues.length).toBeGreaterThan(0);
  });

  it("does not flag when parent has maxWidth", () => {
    const file = makeFile(
      makeNode({
        name: "Page",
        type: "FRAME",
        children: [
          makeNode({
            name: "Root",
            type: "FRAME",
            layoutMode: "HORIZONTAL",
            maxWidth: 1200,
            children: [
              makeNode({
                name: "Left",
                type: "FRAME",
                layoutSizingHorizontal: "FILL",
                absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 100 },
              }),
              makeNode({
                name: "Right",
                type: "FRAME",
                layoutSizingHorizontal: "FILL",
                absoluteBoundingBox: { x: 300, y: 0, width: 300, height: 100 },
              }),
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

  it("flags inside grid layout (grid subType)", () => {
    const file = makeFile(
      makeNode({
        name: "Page",
        type: "FRAME",
        children: [
          makeNode({
            name: "Grid",
            type: "FRAME",
            layoutMode: "GRID",
            children: [
              makeNode({
                name: "Cell",
                type: "FRAME",
                layoutSizingHorizontal: "FILL",
                absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 100 },
              }),
            ],
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "missing-size-constraint",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.violation.subType).toBe("grid");
  });

  it("flags inside flex wrap (wrap subType)", () => {
    const file = makeFile(
      makeNode({
        name: "Page",
        type: "FRAME",
        children: [
          makeNode({
            name: "WrapContainer",
            type: "FRAME",
            layoutMode: "HORIZONTAL",
            layoutWrap: "WRAP",
            children: [
              makeNode({
                name: "Tag1",
                type: "FRAME",
                layoutSizingHorizontal: "FILL",
                absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 40 },
              }),
              makeNode({
                name: "Tag2",
                type: "FRAME",
                layoutSizingHorizontal: "FILL",
                absoluteBoundingBox: { x: 300, y: 0, width: 300, height: 40 },
              }),
            ],
          }),
        ],
      }),
    );
    const result = analyzeFile(file);
    const issues = result.issues.filter(
      (i) => i.rule.definition.id === "missing-size-constraint",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.violation.subType).toBe("wrap");
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
