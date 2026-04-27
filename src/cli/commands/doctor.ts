import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CAC } from "cac";

import { trackEvent, EVENTS } from "../../core/monitoring/index.js";

interface DoctorCheckResult {
  name: string;
  pass: boolean;
  detail?: string;
  remediation?: string;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const CODE_CONNECT_PKG = "@figma/code-connect";
const CODE_CONNECT_DOCS = "https://www.figma.com/code-connect-docs/";

function readPackageJson(cwd: string): PackageJson | undefined {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return undefined;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;
  } catch {
    return undefined;
  }
}

function findCodeConnectVersion(pkg: PackageJson | undefined): string | undefined {
  if (!pkg) return undefined;
  return pkg.dependencies?.[CODE_CONNECT_PKG] ?? pkg.devDependencies?.[CODE_CONNECT_PKG];
}

export function runCodeConnectChecks(cwd: string): DoctorCheckResult[] {
  const pkg = readPackageJson(cwd);
  const ccVersion = findCodeConnectVersion(pkg);
  const figmaConfigExists = existsSync(join(cwd, "figma.config.json"));

  const results: DoctorCheckResult[] = [];

  if (ccVersion) {
    results.push({
      name: `${CODE_CONNECT_PKG} installed`,
      pass: true,
      detail: ccVersion,
    });
  } else {
    results.push({
      name: `${CODE_CONNECT_PKG} not installed`,
      pass: false,
      remediation: pkg
        ? `pnpm add -D ${CODE_CONNECT_PKG}  (or npm/yarn equivalent)`
        : `No package.json found at ${cwd} — run from your project root, or initialise one first.`,
    });
  }

  if (figmaConfigExists) {
    results.push({
      name: "figma.config.json found at repo root",
      pass: true,
    });
  } else {
    results.push({
      name: "figma.config.json not found at repo root",
      pass: false,
      remediation: `see ${CODE_CONNECT_DOCS}`,
    });
  }

  return results;
}

export function formatDoctorReport(results: DoctorCheckResult[]): string {
  const lines: string[] = ["Code Connect"];
  for (const result of results) {
    const icon = result.pass ? "✅" : "❌";
    const detail = result.detail ? ` (${result.detail})` : "";
    lines.push(`  ${icon} ${result.name}${detail}`);
    if (!result.pass && result.remediation) {
      lines.push(`     → ${result.remediation}`);
    }
  }
  lines.push("");
  const allPass = results.every(r => r.pass);
  lines.push(
    allPass
      ? "All checks passed."
      : "Some checks failed. Fix the items above before running the Code Connect flow.",
  );
  return lines.join("\n");
}

export function registerDoctor(cli: CAC): void {
  cli
    .command(
      "doctor",
      "Diagnose Code Connect prerequisites (`@figma/code-connect`, `figma.config.json`)",
    )
    .action(() => {
      const cwd = process.cwd();
      const results = runCodeConnectChecks(cwd);
      console.log(formatDoctorReport(results));

      const passed = results.filter(r => r.pass).length;
      const failed = results.length - passed;

      trackEvent(EVENTS.CLI_DOCTOR, {
        passed,
        failed,
        total: results.length,
      });

      if (failed > 0) {
        process.exitCode = 1;
      }
    });
}
