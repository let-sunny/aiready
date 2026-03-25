import { z } from "zod";

// --- Calibration evidence ---

export const CalibrationEvidenceEntrySchema = z.object({
  ruleId: z.string(),
  type: z.enum(["overscored", "underscored"]),
  actualDifficulty: z.string(),
  fixture: z.string(),
  timestamp: z.string(),
});

export type CalibrationEvidenceEntry = z.infer<typeof CalibrationEvidenceEntrySchema>;

export const CrossRunEvidenceGroupSchema = z.object({
  overscoredCount: z.number(),
  underscoredCount: z.number(),
  overscoredDifficulties: z.array(z.string()),
  underscoredDifficulties: z.array(z.string()),
});

export type CrossRunEvidenceGroup = z.infer<typeof CrossRunEvidenceGroupSchema>;

export type CrossRunEvidence = Record<string, CrossRunEvidenceGroup>;

// --- Discovery evidence ---

export const DISCOVERY_EVIDENCE_SCHEMA_VERSION = 1;

export const DiscoveryEvidenceEntrySchema = z.object({
  description: z.string(),
  category: z.string(),
  impact: z.string(),
  fixture: z.string(),
  timestamp: z.string(),
  source: z.enum(["evaluation", "gap-analysis"]),
});

export type DiscoveryEvidenceEntry = z.infer<typeof DiscoveryEvidenceEntrySchema>;

export const DiscoveryEvidenceFileSchema = z.object({
  schemaVersion: z.number(),
  entries: z.array(DiscoveryEvidenceEntrySchema),
});

export type DiscoveryEvidenceFile = z.infer<typeof DiscoveryEvidenceFileSchema>;
