import { z } from "zod";

const positiveCliNumber = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine(Number.isFinite, "must be a valid number")
  .refine((v) => v > 0, "must be positive");

const figmaScaleNumber = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine(Number.isFinite, "must be a valid number")
  .refine((v) => v >= 1, "must be >= 1");

/** Zod schema for CLI visual-compare options (raw CLI input). */
export const VisualCompareCliOptionsSchema = z.object({
  figmaUrl: z.string().optional(),
  figmaScreenshot: z.string().optional(),
  token: z.string().optional(),
  output: z.string().optional(),
  width: positiveCliNumber.optional(),
  height: positiveCliNumber.optional(),
  figmaScale: figmaScaleNumber.optional(),
  expandRoot: z.boolean().optional(),
});

export type VisualCompareCliOptions = z.infer<typeof VisualCompareCliOptionsSchema>;
