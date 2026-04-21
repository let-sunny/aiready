#!/usr/bin/env tsx
/**
 * Height-axis gate reporter for #413.
 *
 * Aggregates the 24 fixture probes emitted by run-all.sh:
 *   (1) fire-rate: FILL-height containers and INSTANCE-FIXED-height counts
 *   (2) depth histogram across all fixtures
 *   (3) overlap with fixed-size-in-auto-layout (re-runs analyzeFile per fixture
 *       and counts INSTANCE-FIXED-height nodes that also appear as a fire of
 *       that rule)
 *   (4) desktop/mobile split so the verdict doesn't collapse a bimodal
 *       distribution into one mean
 *
 * Output shape is kept visually close to .tmp/403-gate/compare.ts so the two
 * axes can be diffed side-by-side.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { analyzeFile } from "../../src/core/engine/rule-engine.js";
import { loadFile } from "../../src/core/engine/loader.js";
import "../../src/core/rules/index.js";

const ROOT = ".tmp/413-gate";

interface ProbeRow {
  kind: "fill-container" | "instance-fixed";
  nodeId: string;
  nodeName: string;
  nodePath: string;
  depth: number;
  height: string;
  boundFoundAt?: string | null;
  boundAncestorSizing?: string | null;
  stepsToBound?: number;
  parentName?: string;
  parentLayoutMode?: string;
  nodeType?: string;
}

interface Probe {
  fixture: string;
  summary: {
    fillContainers: number;
    bounded: number;
    unbounded: number;
    instanceFixedInAutoLayout: number;
  };
  depthHistogram: Record<string, number>;
  rows: ProbeRow[];
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function platform(name: string): "desktop" | "mobile" | "other" {
  if (name.startsWith("desktop-")) return "desktop";
  if (name.startsWith("mobile-")) return "mobile";
  return "other";
}

const fixtures = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => existsSync(join(ROOT, n, "probe.json")))
  .sort();

if (fixtures.length === 0) {
  console.error(
    `No probe.json files under ${ROOT}/*/ — run .tmp/413-gate/run-all.sh first.`,
  );
  process.exit(1);
}

const probes: Probe[] = fixtures.map(
  (fx) => JSON.parse(readFileSync(join(ROOT, fx, "probe.json"), "utf-8")) as Probe,
);

// ── Section 1: per-fixture counts ──────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════════════");
console.log("Height-axis probe — per-fixture counts (24 fixtures)");
console.log("═══════════════════════════════════════════════════════════════════\n");

console.log(
  `${pad("Fixture", 26)} | ${pad("FILL conts", 10)} | ${pad("unbounded", 9)} | ${pad("INST FIXED (AL)", 15)}`,
);
console.log("-".repeat(80));
for (let i = 0; i < fixtures.length; i++) {
  const fx = fixtures[i]!;
  const p = probes[i]!;
  console.log(
    `${pad(fx, 26)} | ${pad(String(p.summary.fillContainers), 10)} | ${pad(String(p.summary.unbounded), 9)} | ${pad(String(p.summary.instanceFixedInAutoLayout), 15)}`,
  );
}

// ── Section 2: aggregate totals (+ desktop/mobile split) ───────────────────

console.log();
console.log("Aggregate totals:");
const total = {
  fill: 0,
  bounded: 0,
  unbounded: 0,
  instance: 0,
};
const byPlatform: Record<string, typeof total> = {
  desktop: { fill: 0, bounded: 0, unbounded: 0, instance: 0 },
  mobile: { fill: 0, bounded: 0, unbounded: 0, instance: 0 },
  other: { fill: 0, bounded: 0, unbounded: 0, instance: 0 },
};
for (let i = 0; i < fixtures.length; i++) {
  const p = probes[i]!;
  const plat = platform(fixtures[i]!);
  total.fill += p.summary.fillContainers;
  total.bounded += p.summary.bounded;
  total.unbounded += p.summary.unbounded;
  total.instance += p.summary.instanceFixedInAutoLayout;
  byPlatform[plat]!.fill += p.summary.fillContainers;
  byPlatform[plat]!.bounded += p.summary.bounded;
  byPlatform[plat]!.unbounded += p.summary.unbounded;
  byPlatform[plat]!.instance += p.summary.instanceFixedInAutoLayout;
}
console.log(`  FRAME/SECTION FILL-height containers:   ${total.fill}`);
console.log(`    bounded:                              ${total.bounded}`);
console.log(`    unbounded (would fire):               ${total.unbounded}`);
console.log(`  INSTANCE FIXED-height in Auto Layout:   ${total.instance}`);
console.log();
console.log("Desktop / mobile split:");
for (const plat of ["desktop", "mobile"] as const) {
  const t = byPlatform[plat]!;
  console.log(
    `  ${pad(plat, 8)} fill=${t.fill}  unbounded=${t.unbounded}  instance-fixed(AL)=${t.instance}`,
  );
}

// ── Section 3: aggregate depth histogram ───────────────────────────────────

console.log();
console.log("Steps-to-bound histogram (aggregate, bounded rows only):");
const aggHist: Record<string, number> = {};
for (const p of probes) {
  for (const [steps, count] of Object.entries(p.depthHistogram)) {
    aggHist[steps] = (aggHist[steps] ?? 0) + count;
  }
}
const histKeys = Object.keys(aggHist).sort((a, b) => Number(a) - Number(b));
if (histKeys.length === 0) {
  console.log("  (no bounded rows — no FILL-height containers fired)");
} else {
  for (const k of histKeys) console.log(`  ${k} step(s): ${aggHist[k]}`);
}

// ── Section 4: overlap with fixed-size-in-auto-layout ──────────────────────
//
// For each INSTANCE-FIXED-height probe row, check whether the same nodeId
// appears as a fire of fixed-size-in-auto-layout in analyzeFile output. High
// overlap means the additive-score rationale from #403's page-instance-fixed
// does NOT directly apply — the score channel is already covered.

console.log();
console.log("═══════════════════════════════════════════════════════════════════");
console.log("Overlap: INSTANCE-FIXED-height vs fixed-size-in-auto-layout fires");
console.log("═══════════════════════════════════════════════════════════════════\n");

let totalInstanceFires = 0;
let totalOverlap = 0;
const overlapRows: Array<{
  fixture: string;
  overlapping: number;
  instanceFires: number;
  exampleOverlapPath?: string;
}> = [];

for (let i = 0; i < fixtures.length; i++) {
  const fx = fixtures[i]!;
  const probe = probes[i]!;
  const instanceFires = probe.rows.filter((r) => r.kind === "instance-fixed");
  if (instanceFires.length === 0) {
    overlapRows.push({ fixture: fx, overlapping: 0, instanceFires: 0 });
    continue;
  }

  const { file } = await loadFile(`fixtures/done/${fx}`);
  const result = analyzeFile(file, { scope: "page" });
  const fixedSizeIds = new Set<string>();
  for (const issue of result.issues) {
    if (issue.rule.definition.id === "fixed-size-in-auto-layout") {
      fixedSizeIds.add(issue.violation.nodeId);
    }
  }

  let overlap = 0;
  let example: string | undefined;
  for (const row of instanceFires) {
    if (fixedSizeIds.has(row.nodeId)) {
      overlap++;
      if (!example) example = row.nodePath;
    }
  }
  totalInstanceFires += instanceFires.length;
  totalOverlap += overlap;
  overlapRows.push({
    fixture: fx,
    overlapping: overlap,
    instanceFires: instanceFires.length,
    ...(example ? { exampleOverlapPath: example } : {}),
  });
}

console.log(
  `${pad("Fixture", 26)} | ${pad("inst-fires", 10)} | ${pad("overlap", 7)} | example overlap path`,
);
console.log("-".repeat(100));
for (const r of overlapRows) {
  if (r.instanceFires === 0) continue;
  console.log(
    `${pad(r.fixture, 26)} | ${pad(String(r.instanceFires), 10)} | ${pad(String(r.overlapping), 7)} | ${r.exampleOverlapPath ?? "—"}`,
  );
}
const anyInstance = overlapRows.some((r) => r.instanceFires > 0);
if (!anyInstance) console.log("(no INSTANCE-FIXED-height fires in any fixture)");

console.log();
console.log(
  `Overlap total: ${totalOverlap} / ${totalInstanceFires}  (${
    totalInstanceFires === 0
      ? "—"
      : `${Math.round((totalOverlap / totalInstanceFires) * 100)}%`
  })`,
);

console.log();
console.log("Done.");
