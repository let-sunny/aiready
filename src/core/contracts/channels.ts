import { z } from "zod";

/**
 * #402 shared output-channel vocabulary.
 * Detection stays rule-based; output channel and persistence intent vary by
 * consumer payload (score/transient vs annotation/durable).
 */
export const DetectionSchema = z.literal("rule-based");
export const OutputChannelSchema = z.enum(["score", "annotation"]);
export const PersistenceIntentSchema = z.enum(["transient", "durable"]);

export type Detection = z.infer<typeof DetectionSchema>;
export type OutputChannel = z.infer<typeof OutputChannelSchema>;
export type PersistenceIntent = z.infer<typeof PersistenceIntentSchema>;
