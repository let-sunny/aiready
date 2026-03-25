import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { numericSuffixName } from "./index.js";

function makeNode(overrides?: Partial<AnalysisNode>): AnalysisNode {
  return { id: "1:1", name: "TestNode", type: "FRAME", visible: true, ...overrides };
}

function makeFile(): AnalysisFile {
  return {
    fileKey: "test-file",
    name: "Test File",
    lastModified: "2026-01-01T00:00:00Z",
    version: "1",
    document: makeNode({ id: "0:1", name: "Document", type: "DOCUMENT" }),
    components: {},
    styles: {},
  };
}

function makeContext(overrides?: Partial<RuleContext>): RuleContext {
  return {
    file: makeFile(),
    depth: 2,
    componentDepth: 0,
    maxDepth: 10,
    path: ["Page", "Section"],
    analysisState: new Map(),
    ...overrides,
  };
}

describe("numeric-suffix-name", () => {
  it("has correct rule definition metadata", () => {
    expect(numericSuffixName.definition.id).toBe("numeric-suffix-name");
    expect(numericSuffixName.definition.category).toBe("naming");
  });

  it("flags names with numeric suffix like 'Card 2'", () => {
    const node = makeNode({ name: "Card 2" });
    const result = numericSuffixName.check(node, makeContext());
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("numeric-suffix-name");
  });

  it("flags names like 'Section 10'", () => {
    const node = makeNode({ name: "Section 10" });
    const result = numericSuffixName.check(node, makeContext());
    expect(result).not.toBeNull();
  });

  it("does not flag default names (caught by default-name rule)", () => {
    const node = makeNode({ name: "Frame 1" });
    expect(numericSuffixName.check(node, makeContext())).toBeNull();
  });

  it("returns null for names without numeric suffix", () => {
    const node = makeNode({ name: "ProductCard" });
    expect(numericSuffixName.check(node, makeContext())).toBeNull();
  });

  it("returns null for excluded name patterns", () => {
    const node = makeNode({ name: "icon 3" });
    expect(numericSuffixName.check(node, makeContext())).toBeNull();
  });

  it("returns null for names ending in number without space", () => {
    const node = makeNode({ name: "Step3" });
    expect(numericSuffixName.check(node, makeContext())).toBeNull();
  });
});
