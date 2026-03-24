import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// --- Calibration evidence ---

export interface CalibrationEvidenceEntry {
  ruleId: string;
  type: "overscored" | "underscored";
  actualDifficulty: string;
  fixture: string;
  timestamp: string;
}

export interface CrossRunEvidence {
  [ruleId: string]: {
    overscoredCount: number;
    underscoredCount: number;
    overscoredDifficulties: string[];
    underscoredDifficulties: string[];
  };
}

const DEFAULT_CALIBRATION_PATH = resolve("data/calibration-evidence.json");

function readJsonArray<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
    return Array.isArray(raw) ? (raw as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(filePath: string, data: T[]): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Load calibration evidence and group by ruleId for the tuning agent.
 */
export function loadCalibrationEvidence(
  evidencePath: string = DEFAULT_CALIBRATION_PATH
): CrossRunEvidence {
  const entries = readJsonArray<CalibrationEvidenceEntry>(evidencePath);
  const result: CrossRunEvidence = {};

  for (const entry of entries) {
    let group = result[entry.ruleId];
    if (!group) {
      group = {
        overscoredCount: 0,
        underscoredCount: 0,
        overscoredDifficulties: [],
        underscoredDifficulties: [],
      };
      result[entry.ruleId] = group;
    }

    if (entry.type === "overscored") {
      group.overscoredCount++;
      group.overscoredDifficulties.push(entry.actualDifficulty);
    } else {
      group.underscoredCount++;
      group.underscoredDifficulties.push(entry.actualDifficulty);
    }
  }

  return result;
}

/**
 * Append new calibration evidence entries (overscored/underscored mismatches).
 */
export function appendCalibrationEvidence(
  entries: CalibrationEvidenceEntry[],
  evidencePath: string = DEFAULT_CALIBRATION_PATH
): void {
  if (entries.length === 0) return;
  const existing = readJsonArray<CalibrationEvidenceEntry>(evidencePath);
  existing.push(...entries);
  writeJsonArray(evidencePath, existing);
}

/**
 * Remove entries for rules whose scores were applied/revised by the Arbitrator.
 */
export function pruneCalibrationEvidence(
  appliedRuleIds: string[],
  evidencePath: string = DEFAULT_CALIBRATION_PATH
): void {
  if (appliedRuleIds.length === 0) return;
  const ruleSet = new Set(appliedRuleIds);
  const existing = readJsonArray<CalibrationEvidenceEntry>(evidencePath);
  const pruned = existing.filter((e) => !ruleSet.has(e.ruleId));
  writeJsonArray(evidencePath, pruned);
}

// --- Discovery evidence ---

export interface DiscoveryEvidenceEntry {
  description: string;
  category: string;
  impact: string;
  fixture: string;
  timestamp: string;
  source: "evaluation" | "gap-analysis";
}

const DEFAULT_DISCOVERY_PATH = resolve("data/discovery-evidence.json");

/**
 * Load all discovery evidence entries.
 */
export function loadDiscoveryEvidence(
  evidencePath: string = DEFAULT_DISCOVERY_PATH
): DiscoveryEvidenceEntry[] {
  return readJsonArray<DiscoveryEvidenceEntry>(evidencePath);
}

/**
 * Append new discovery evidence entries (missing-rule + gap analysis).
 */
export function appendDiscoveryEvidence(
  entries: DiscoveryEvidenceEntry[],
  evidencePath: string = DEFAULT_DISCOVERY_PATH
): void {
  if (entries.length === 0) return;
  const existing = readJsonArray<DiscoveryEvidenceEntry>(evidencePath);
  existing.push(...entries);
  writeJsonArray(evidencePath, existing);
}

/**
 * Remove entries for categories that were addressed by rule discovery.
 */
export function pruneDiscoveryEvidence(
  categories: string[],
  evidencePath: string = DEFAULT_DISCOVERY_PATH
): void {
  if (categories.length === 0) return;
  const catSet = new Set(categories.map((c) => c.toLowerCase()));
  const existing = readJsonArray<DiscoveryEvidenceEntry>(evidencePath);
  const pruned = existing.filter((e) => !catSet.has(e.category.toLowerCase()));
  writeJsonArray(evidencePath, pruned);
}
