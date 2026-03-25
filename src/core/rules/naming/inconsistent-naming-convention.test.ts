import type { RuleContext } from "../../contracts/rule.js";
import type { AnalysisFile, AnalysisNode } from "../../contracts/figma-node.js";
import { inconsistentNamingConvention } from "./index.js";

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

describe("inconsistent-naming-convention", () => {
  it("has correct rule definition metadata", () => {
    expect(inconsistentNamingConvention.definition.id).toBe("inconsistent-naming-convention");
    expect(inconsistentNamingConvention.definition.category).toBe("naming");
  });

  it("flags node with different convention from dominant siblings", () => {
    const sibA = makeNode({ id: "2:1", name: "my-card" });
    const sibB = makeNode({ id: "2:2", name: "my-header" });
    const node = makeNode({ id: "1:1", name: "myFooter" }); // camelCase vs kebab-case
    const siblings = [node, sibA, sibB];

    const result = inconsistentNamingConvention.check(node, makeContext({ siblings }));
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("inconsistent-naming-convention");
    expect(result!.message).toContain("camelCase");
    expect(result!.message).toContain("kebab-case");
  });

  it("returns null when all siblings use the same convention", () => {
    const sibA = makeNode({ id: "2:1", name: "my-card" });
    const sibB = makeNode({ id: "2:2", name: "my-header" });
    const node = makeNode({ id: "1:1", name: "my-footer" });
    const siblings = [node, sibA, sibB];

    expect(inconsistentNamingConvention.check(node, makeContext({ siblings }))).toBeNull();
  });

  it("returns null when no siblings", () => {
    const node = makeNode({ name: "my-card" });
    expect(inconsistentNamingConvention.check(node, makeContext())).toBeNull();
  });

  it("returns null when fewer than 2 siblings", () => {
    const node = makeNode({ name: "my-card" });
    expect(inconsistentNamingConvention.check(node, makeContext({ siblings: [node] }))).toBeNull();
  });

  it("returns null when convention cannot be detected", () => {
    const sibA = makeNode({ id: "2:1", name: "123" });
    const node = makeNode({ id: "1:1", name: "456" });
    const siblings = [node, sibA];

    expect(inconsistentNamingConvention.check(node, makeContext({ siblings }))).toBeNull();
  });
});
