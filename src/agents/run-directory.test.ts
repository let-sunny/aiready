import { mkdtempSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";
import {
  extractFixtureName,
  parseRunDirName,
  createCalibrationRunDir,
  createRuleDiscoveryRunDir,
  listCalibrationRuns,
} from "./run-directory.js";

describe("extractFixtureName", () => {
  it("extracts name from path with directory and .json", () => {
    expect(extractFixtureName("fixtures/material3-kit.json")).toBe("material3-kit");
  });

  it("extracts name from bare filename", () => {
    expect(extractFixtureName("my-design.json")).toBe("my-design");
  });

  it("returns as-is when no .json extension", () => {
    expect(extractFixtureName("fixtures/something")).toBe("something");
  });

  it("handles nested paths", () => {
    expect(extractFixtureName("a/b/c/deep-nested.json")).toBe("deep-nested");
  });
});

describe("parseRunDirName", () => {
  it("splits on last double-dash", () => {
    const result = parseRunDirName("material3-kit--2026-03-24-0200");
    expect(result.name).toBe("material3-kit");
    expect(result.timestamp).toBe("2026-03-24-0200");
  });

  it("handles names with multiple dashes", () => {
    const result = parseRunDirName("simple-ds-card-grid--2026-03-24-0200");
    expect(result.name).toBe("simple-ds-card-grid");
    expect(result.timestamp).toBe("2026-03-24-0200");
  });

  it("returns full string as name when no double-dash", () => {
    const result = parseRunDirName("no-separator");
    expect(result.name).toBe("no-separator");
    expect(result.timestamp).toBe("");
  });
});

describe("createCalibrationRunDir", () => {
  const origCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "run-dir-test-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates directory and returns path with fixture name and timestamp", () => {
    const runDir = createCalibrationRunDir("material3-kit");
    expect(existsSync(runDir)).toBe(true);

    const dirName = basename(runDir);
    expect(dirName).toMatch(/^material3-kit--\d{4}-\d{2}-\d{2}-\d{4}$/);
  });

  it("creates directory under logs/calibration/", () => {
    const runDir = createCalibrationRunDir("test-fixture");
    expect(runDir).toContain("logs/calibration/");
  });
});

describe("createRuleDiscoveryRunDir", () => {
  const origCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "run-dir-test-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates directory with date-only timestamp", () => {
    const runDir = createRuleDiscoveryRunDir("text-alignment");
    expect(existsSync(runDir)).toBe(true);

    const dirName = basename(runDir);
    expect(dirName).toMatch(/^text-alignment--\d{4}-\d{2}-\d{2}$/);
  });
});

describe("listCalibrationRuns", () => {
  const origCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "run-dir-test-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when no runs exist", () => {
    expect(listCalibrationRuns()).toEqual([]);
  });

  it("lists run directories sorted, ignoring non-run files", () => {
    const dir1 = createCalibrationRunDir("aaa-fixture");
    const dir2 = createCalibrationRunDir("zzz-fixture");
    const runs = listCalibrationRuns();

    expect(runs.length).toBe(2);
    expect(runs[0]).toBe(dir1);
    expect(runs[1]).toBe(dir2);
  });
});
