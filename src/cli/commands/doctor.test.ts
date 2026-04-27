import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { formatDoctorReport, runCodeConnectChecks } from "./doctor.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "canicode-doctor-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function writePkg(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}): void {
  writeFileSync(
    join(tmp, "package.json"),
    JSON.stringify({ name: "fixture", dependencies: deps, devDependencies: devDeps }),
  );
}

describe("runCodeConnectChecks", () => {
  it("flags both checks failed when neither package.json nor figma.config.json exist", () => {
    const results = runCodeConnectChecks(tmp);
    expect(results).toHaveLength(2);
    expect(results.every(r => !r.pass)).toBe(true);
    expect(results[0]?.remediation).toMatch(/No package\.json/);
  });

  it("passes when @figma/code-connect is in devDependencies and figma.config.json exists", () => {
    writePkg({}, { "@figma/code-connect": "^1.2.3" });
    writeFileSync(join(tmp, "figma.config.json"), "{}");
    const results = runCodeConnectChecks(tmp);
    expect(results.every(r => r.pass)).toBe(true);
    expect(results[0]?.detail).toBe("^1.2.3");
  });

  it("detects code-connect in dependencies (not just devDependencies)", () => {
    writePkg({ "@figma/code-connect": "1.0.0" });
    const results = runCodeConnectChecks(tmp);
    expect(results[0]?.pass).toBe(true);
    expect(results[0]?.detail).toBe("1.0.0");
  });

  it("recommends pnpm install when package.json exists but code-connect is missing", () => {
    writePkg({}, { vitest: "^1.0.0" });
    const results = runCodeConnectChecks(tmp);
    expect(results[0]?.pass).toBe(false);
    expect(results[0]?.remediation).toMatch(/pnpm add -D @figma\/code-connect/);
  });

  it("links the Code Connect docs when figma.config.json is missing", () => {
    writePkg({}, { "@figma/code-connect": "^1.0.0" });
    const results = runCodeConnectChecks(tmp);
    expect(results[1]?.pass).toBe(false);
    expect(results[1]?.remediation).toMatch(/figma\.com\/code-connect-docs/);
  });

  it("survives a malformed package.json without throwing", () => {
    writeFileSync(join(tmp, "package.json"), "{ this is not json");
    const results = runCodeConnectChecks(tmp);
    expect(results[0]?.pass).toBe(false);
  });
});

describe("formatDoctorReport", () => {
  it("renders ✅/❌ with detail and remediation lines", () => {
    const out = formatDoctorReport([
      { name: "@figma/code-connect installed", pass: true, detail: "1.0.0" },
      {
        name: "figma.config.json not found at repo root",
        pass: false,
        remediation: "see https://www.figma.com/code-connect-docs/",
      },
    ]);
    expect(out).toContain("✅ @figma/code-connect installed (1.0.0)");
    expect(out).toContain("❌ figma.config.json not found at repo root");
    expect(out).toContain("→ see https://www.figma.com/code-connect-docs/");
    expect(out).toContain("Some checks failed");
  });

  it("ends with all-pass summary when every check passes", () => {
    const out = formatDoctorReport([
      { name: "a", pass: true },
      { name: "b", pass: true },
    ]);
    expect(out).toContain("All checks passed.");
    expect(out).not.toContain("Some checks failed");
  });
});

describe("doctor command", () => {
  it("creates an empty fixture directory and verifies isolation", () => {
    mkdirSync(join(tmp, "subdir"));
    const results = runCodeConnectChecks(join(tmp, "subdir"));
    expect(results.every(r => !r.pass)).toBe(true);
  });
});
