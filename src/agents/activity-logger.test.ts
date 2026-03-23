import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";
import { ActivityLogger } from "./activity-logger.js";

/**
 * Parse a .jsonl file into an array of parsed JSON objects.
 */
function readJsonLines(filePath: string): Record<string, unknown>[] {
  const content = readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("ActivityLogger", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "activity-logger-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("logStep creates directory and file if they don't exist, file contains step data", async () => {
    const runDir = join(tempDir, "nested", "run");
    const logger = new ActivityLogger(runDir);

    await logger.logStep({
      step: "Analyze Node",
      nodePath: "Frame > Button",
      result: "success",
      durationMs: 150,
    });

    const logPath = logger.getLogPath();
    expect(existsSync(logPath)).toBe(true);
    expect(logPath).toContain("activity.jsonl");

    const entries = readJsonLines(logPath);
    // First entry is the session-start header, second is our step
    const stepEntry = entries.find((e) => e["step"] === "Analyze Node");
    expect(stepEntry).toBeDefined();
    expect(stepEntry!["nodePath"]).toBe("Frame > Button");
    expect(stepEntry!["result"]).toBe("success");
    expect(stepEntry!["durationMs"]).toBe(150);
    expect(typeof stepEntry!["timestamp"]).toBe("string");
  });

  it("logStep with nodePath includes nodePath field in entry", async () => {
    const logger = new ActivityLogger(tempDir);

    await logger.logStep({
      step: "Convert Component",
      nodePath: "Page > Header > Logo",
      result: "converted",
      durationMs: 200,
    });

    const entries = readJsonLines(logger.getLogPath());
    const stepEntry = entries.find((e) => e["step"] === "Convert Component");
    expect(stepEntry!["nodePath"]).toBe("Page > Header > Logo");
  });

  it("logStep without nodePath omits nodePath field", async () => {
    const logger = new ActivityLogger(tempDir);

    await logger.logStep({
      step: "Initialize Pipeline",
      result: "ready",
      durationMs: 10,
    });

    const entries = readJsonLines(logger.getLogPath());
    const stepEntry = entries.find((e) => e["step"] === "Initialize Pipeline");
    expect(stepEntry).toBeDefined();
    expect("nodePath" in stepEntry!).toBe(false);
    expect(stepEntry!["result"]).toBe("ready");
    expect(stepEntry!["durationMs"]).toBe(10);
  });

  it("logSummary writes summary entry with all fields", async () => {
    const logger = new ActivityLogger(tempDir);

    await logger.logSummary({
      totalDurationMs: 5000,
      nodesAnalyzed: 42,
      nodesConverted: 38,
      mismatches: 4,
      adjustments: 3,
      status: "completed",
    });

    const entries = readJsonLines(logger.getLogPath());
    const summaryEntry = entries.find((e) => e["step"] === "Pipeline Summary");
    expect(summaryEntry).toBeDefined();
    expect(summaryEntry!["result"]).toBe("completed");
    expect(summaryEntry!["durationMs"]).toBe(5000);
    expect(summaryEntry!["nodesAnalyzed"]).toBe(42);
    expect(summaryEntry!["nodesConverted"]).toBe(38);
    expect(summaryEntry!["mismatches"]).toBe(4);
    expect(summaryEntry!["adjustments"]).toBe(3);
  });

  it("multiple logStep calls append to the same file (not overwrite)", async () => {
    const logger = new ActivityLogger(tempDir);

    await logger.logStep({
      step: "First Step",
      result: "ok",
      durationMs: 100,
    });

    await logger.logStep({
      step: "Second Step",
      result: "done",
      durationMs: 200,
    });

    const entries = readJsonLines(logger.getLogPath());
    const firstEntry = entries.find((e) => e["step"] === "First Step");
    const secondEntry = entries.find((e) => e["step"] === "Second Step");

    expect(firstEntry).toBeDefined();
    expect(secondEntry).toBeDefined();
    expect(firstEntry!["result"]).toBe("ok");
    expect(secondEntry!["result"]).toBe("done");
  });

  it("getLogPath returns activity.jsonl inside the run directory", () => {
    const logger = new ActivityLogger(tempDir);
    const logPath = logger.getLogPath();

    expect(logPath.endsWith("activity.jsonl")).toBe(true);
    expect(logPath).toContain(tempDir);
  });
});
