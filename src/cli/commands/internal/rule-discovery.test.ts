import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";

import { filterDiscoveryEvidence, readDecision } from "./rule-discovery.js";

describe("filterDiscoveryEvidence", () => {
  it("returns empty array when no matching evidence exists", () => {
    // data/discovery-evidence.json may or may not exist in the repo
    // but a nonexistent category should always return empty
    const result = filterDiscoveryEvidence("zzz-nonexistent-category-zzz");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("returns empty for single-character keyword", () => {
    expect(filterDiscoveryEvidence("a")).toHaveLength(0);
  });

  it("returns empty for all-short-token keyword", () => {
    expect(filterDiscoveryEvidence("a x y")).toHaveLength(0);
  });

  it("returns empty for empty string", () => {
    expect(filterDiscoveryEvidence("")).toHaveLength(0);
    expect(filterDiscoveryEvidence("   ")).toHaveLength(0);
  });

  it("returns typed DiscoveryEvidenceEntry array", () => {
    const result = filterDiscoveryEvidence("anything");
    expect(Array.isArray(result)).toBe(true);
    // Even if empty, the type should be correct (not unknown[])
    for (const entry of result) {
      expect(typeof entry.category).toBe("string");
      expect(typeof entry.description).toBe("string");
    }
  });
});

describe("readDecision", () => {
  let runDir: string;

  beforeEach(() => {
    runDir = mkdtempSync(join(tmpdir(), "decision-test-"));
  });

  afterEach(async () => {
    await rm(runDir, { recursive: true, force: true });
  });

  it("returns commit action for KEEP decision", () => {
    writeFileSync(join(runDir, "decision.json"), JSON.stringify({
      decision: "KEEP",
      ruleId: "my-new-rule",
      category: "code-quality",
      reason: "Improves structure detection",
    }));

    const result = readDecision(runDir);
    expect(result).toEqual({
      action: "commit",
      ruleId: "my-new-rule",
      category: "code-quality",
      reason: "Improves structure detection",
    });
  });

  it("returns adjust action for ADJUST decision", () => {
    writeFileSync(join(runDir, "decision.json"), JSON.stringify({
      decision: "ADJUST",
      ruleId: "my-rule",
      category: "minor",
      reason: "Score too high",
    }));

    const result = readDecision(runDir);
    expect(result!.action).toBe("adjust");
  });

  it("returns revert action for DROP decision", () => {
    writeFileSync(join(runDir, "decision.json"), JSON.stringify({
      decision: "DROP",
      ruleId: "bad-rule",
      category: "token-management",
      reason: "Too many false positives",
    }));

    const result = readDecision(runDir);
    expect(result!.action).toBe("revert");
  });

  it("normalizes decision casing", () => {
    writeFileSync(join(runDir, "decision.json"), JSON.stringify({
      decision: "keep",
      ruleId: "r",
      category: "c",
    }));

    const result = readDecision(runDir);
    expect(result!.action).toBe("commit");
  });

  it("returns null for missing decision.json", () => {
    expect(readDecision(runDir)).toBeNull();
  });

  it("returns null for invalid decision value", () => {
    writeFileSync(join(runDir, "decision.json"), JSON.stringify({
      decision: "MAYBE",
    }));

    expect(readDecision(runDir)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    writeFileSync(join(runDir, "decision.json"), "not json");
    expect(readDecision(runDir)).toBeNull();
  });
});
