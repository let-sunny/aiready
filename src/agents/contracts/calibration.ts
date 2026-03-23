import { z } from "zod";

export const SamplingStrategySchema = z.enum(["all", "top-issues", "random"]);
export type SamplingStrategy = z.infer<typeof SamplingStrategySchema>;

export const CalibrationStatusSchema = z.enum([
  "pending",
  "analyzing",
  "converting",
  "evaluating",
  "tuning",
  "completed",
  "failed",
]);
export type CalibrationStatus = z.infer<typeof CalibrationStatusSchema>;

export const CalibrationConfigSchema = z.object({
  input: z.string(),
  token: z.string().optional(),
  targetNodeId: z.string().optional(),
  maxConversionNodes: z.number().int().positive().default(20),
  samplingStrategy: SamplingStrategySchema.default("top-issues"),
  outputPath: z.string().default("logs/calibration/calibration-report.md"),
  runDir: z.string().optional(),
});

export type CalibrationConfig = z.infer<typeof CalibrationConfigSchema>;

export interface CalibrationRun {
  config: CalibrationConfig;
  status: CalibrationStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
}
