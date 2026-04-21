#!/usr/bin/env tsx
/**
 * Height-axis evidence probe for #413 (mirrors .tmp/403-gate/walker-sanity.ts).
 *
 * Answers: how many FRAME/SECTION FILL-height containers exist, how many have
 * an ancestor that terminates the height chain, and how many INSTANCE
 * FIXED-height nodes sit inside an Auto Layout parent (the `page-instance-fixed`
 * analogue on the height axis).
 *
 * Excludes INSTANCE descendants (Plugin API ignores min/max writes there — same
 * actionability filter as the production rule) so the probe reflects what a
 * height-axis rule would actually fire on.
 *
 * Usage:
 *   tsx walker-sanity-height.ts <fixture-dir> [--json-out <path>]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadFile } from "../../src/core/engine/loader.js";
import "../../src/core/rules/index.js";
import type { AnalysisNode } from "../../src/core/contracts/figma-node.js";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const FIXTURE = positional[0] ?? "fixtures/done/desktop-home-page";
const jsonOutIdx = args.indexOf("--json-out");
const JSON_OUT = jsonOutIdx !== -1 ? args[jsonOutIdx + 1] : null;

const CONTAINER_TYPES = new Set(["FRAME", "SECTION"]);

function establishesOwnHeightBound(node: AnalysisNode): boolean {
  if (node.layoutSizingVertical === "FIXED") return true;
  if (node.minHeight !== undefined || node.maxHeight !== undefined) return true;
  return false;
}

function describeBound(node: AnalysisNode): string {
  const parts: string[] = [];
  if (node.layoutSizingVertical === "FIXED") parts.push("FIXED");
  if (node.minHeight !== undefined) parts.push(`minHeight=${node.minHeight}`);
  if (node.maxHeight !== undefined) parts.push(`maxHeight=${node.maxHeight}`);
  return parts.join(", ");
}

function formatHeight(node: AnalysisNode): string {
  return node.absoluteBoundingBox
    ? `${node.absoluteBoundingBox.height}px`
    : "unknown";
}

interface FillRow {
  kind: "fill-container";
  nodeId: string;
  nodeName: string;
  nodeType: string;
  nodePath: string;
  depth: number;
  height: string;
  boundFoundAt: string | null;
  boundAncestorSizing: string | null;
  stepsToBound: number;
}

interface InstanceRow {
  kind: "instance-fixed";
  nodeId: string;
  nodeName: string;
  nodePath: string;
  depth: number;
  height: string;
  parentName: string;
  parentLayoutMode: string;
}

type Row = FillRow | InstanceRow;

const fillRows: FillRow[] = [];
const instanceRows: InstanceRow[] = [];

function hasInstanceAncestor(ancestors: AnalysisNode[]): boolean {
  return ancestors.some((a) => a.type === "INSTANCE");
}

function walk(
  node: AnalysisNode,
  path: string[],
  depth: number,
  ancestors: AnalysisNode[],
): void {
  const fullPath = [...path, node.name];

  // Actionability filter: mirror the production rule — exclude nodes whose
  // ancestor chain contains an INSTANCE (Plugin API ignores writes there).
  // INSTANCE nodes themselves remain in scope (that is the page-instance-fixed
  // analogue for the height axis).
  const insideInstance = hasInstanceAncestor(ancestors);

  if (
    !insideInstance &&
    CONTAINER_TYPES.has(node.type) &&
    node.layoutSizingVertical === "FILL"
  ) {
    let boundAt: AnalysisNode | null = null;
    let stepsToBound = 0;
    for (let i = ancestors.length - 1; i >= 0; i--) {
      stepsToBound++;
      if (establishesOwnHeightBound(ancestors[i]!)) {
        boundAt = ancestors[i]!;
        break;
      }
    }
    fillRows.push({
      kind: "fill-container",
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      nodePath: fullPath.join(" > "),
      depth,
      height: formatHeight(node),
      boundFoundAt: boundAt ? boundAt.name : null,
      boundAncestorSizing: boundAt ? describeBound(boundAt) : null,
      stepsToBound: boundAt ? stepsToBound : -1,
    });
  }

  if (
    !insideInstance &&
    node.type === "INSTANCE" &&
    node.layoutSizingVertical === "FIXED"
  ) {
    const parent = ancestors[ancestors.length - 1];
    if (parent && parent.layoutMode && parent.layoutMode !== "NONE") {
      instanceRows.push({
        kind: "instance-fixed",
        nodeId: node.id,
        nodeName: node.name,
        nodePath: fullPath.join(" > "),
        depth,
        height: formatHeight(node),
        parentName: parent.name,
        parentLayoutMode: parent.layoutMode,
      });
    }
  }

  if (node.children) {
    const next = [...ancestors, node];
    for (const child of node.children) walk(child, fullPath, depth + 1, next);
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main() {
  console.log(`Height-axis sanity probe on ${FIXTURE}`);
  const { file } = await loadFile(FIXTURE);
  walk(file.document, [], 0, []);

  const bounded = fillRows.filter((r) => r.boundFoundAt !== null);
  const unbounded = fillRows.filter((r) => r.boundFoundAt === null);

  console.log();
  console.log(`FRAME/SECTION FILL-height containers:  ${fillRows.length}`);
  console.log(`  → bound found in ancestor chain:    ${bounded.length}`);
  console.log(`  → no bound to root (would fire):    ${unbounded.length}`);
  console.log(`INSTANCE FIXED-height in Auto Layout: ${instanceRows.length}`);
  console.log();

  if (bounded.length > 0) {
    console.log("Sample bounded FILL-height containers (first 8):");
    console.log(
      "  depth | steps | bound ancestor                | ancestor sizing              | FILL node path",
    );
    console.log("  " + "-".repeat(120));
    for (const r of bounded.slice(0, 8)) {
      console.log(
        `  ${pad(String(r.depth), 5)} | ${pad(String(r.stepsToBound), 5)} | ${pad(r.boundFoundAt ?? "", 29)} | ${pad(r.boundAncestorSizing ?? "", 28)} | ${r.nodePath}`,
      );
    }
    console.log();
  }

  if (unbounded.length > 0) {
    console.log("Unbounded FILL-height containers (would fire):");
    for (const r of unbounded.slice(0, 20)) {
      console.log(`  depth=${r.depth}  h=${r.height}  ${r.nodePath}`);
    }
    console.log();
  }

  if (instanceRows.length > 0) {
    console.log("INSTANCE FIXED-height in Auto Layout parent (first 20):");
    for (const r of instanceRows.slice(0, 20)) {
      console.log(
        `  depth=${r.depth}  h=${r.height}  parent=${r.parentName} (${r.parentLayoutMode})  ${r.nodePath}`,
      );
    }
    console.log();
  }

  const depthHistogram: Record<number, number> = {};
  for (const r of bounded) {
    depthHistogram[r.stepsToBound] = (depthHistogram[r.stepsToBound] ?? 0) + 1;
  }
  console.log("Steps-to-bound histogram:");
  for (const [steps, count] of Object.entries(depthHistogram).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )) {
    console.log(`  ${steps} step(s): ${count}`);
  }

  if (JSON_OUT) {
    const payload = {
      fixture: FIXTURE,
      summary: {
        fillContainers: fillRows.length,
        bounded: bounded.length,
        unbounded: unbounded.length,
        instanceFixedInAutoLayout: instanceRows.length,
      },
      depthHistogram,
      rows: [...fillRows, ...instanceRows] as Row[],
    };
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, JSON.stringify(payload, null, 2));
    console.log();
    console.log(`JSON output: ${JSON_OUT}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
