import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { generateGapRuleReport } from "./gap-rule-report.js";

describe("generateGapRuleReport", () => {
  const tmpRoot = join(process.cwd(), "logs/calibration/.gap-report-test");

  afterEach(() => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("aggregates gap files from run directories and writes markdown sections", () => {
    // Create two run directories with gaps.json
    const runA = join(tmpRoot, "fx-a--2026-03-24-0100");
    const runB = join(tmpRoot, "fx-b--2026-03-24-0200");
    mkdirSync(runA, { recursive: true });
    mkdirSync(runB, { recursive: true });

    writeFileSync(
      join(runA, "gaps.json"),
      JSON.stringify({
        fileKey: "fx-a",
        gaps: [
          {
            category: "structure",
            area: "Title",
            description: "Alignment mismatch",
            coveredByExistingRule: false,
            actionable: true,
          },
        ],
        newRuleSuggestions: [{ ruleId: "text-alignment-mismatch" }],
      }),
      "utf-8"
    );

    writeFileSync(
      join(runB, "gaps.json"),
      JSON.stringify({
        fileKey: "fx-b",
        gaps: [
          {
            category: "structure",
            area: "Title",
            description: "Alignment mismatch",
            coveredByExistingRule: false,
            actionable: true,
          },
        ],
        newRuleSuggestions: [{ ruleId: "text-alignment-mismatch" }],
      }),
      "utf-8"
    );

    const { markdown, runCount, gapRunCount } = generateGapRuleReport({
      calibrationDir: tmpRoot,
      minPatternRepeat: 2,
    });

    expect(gapRunCount).toBe(2);
    expect(runCount).toBe(0); // No analysis.json + conversion.json in these dirs
    expect(markdown).toContain("structure");
    expect(markdown).toContain("text-alignment-mismatch");
    expect(markdown).toContain("Repeating patterns");
  });

  it("extracts fixture key from run directory name when no fileKey in JSON", () => {
    const runDir = join(tmpRoot, "material3-kit--2026-03-24-0300");
    mkdirSync(runDir, { recursive: true });

    writeFileSync(
      join(runDir, "gaps.json"),
      JSON.stringify({
        gaps: [
          {
            category: "spacing",
            description: "Padding off by 4px",
            actionable: true,
          },
        ],
      }),
      "utf-8"
    );

    const { markdown } = generateGapRuleReport({
      calibrationDir: tmpRoot,
      minPatternRepeat: 1,
    });

    expect(markdown).toContain("material3-kit");
  });

  it("returns empty report when no run directories exist", () => {
    mkdirSync(tmpRoot, { recursive: true });

    const { markdown, runCount, gapRunCount } = generateGapRuleReport({
      calibrationDir: tmpRoot,
      minPatternRepeat: 2,
    });

    expect(runCount).toBe(0);
    expect(gapRunCount).toBe(0);
    expect(markdown).toContain("No gap entries found");
  });
});
