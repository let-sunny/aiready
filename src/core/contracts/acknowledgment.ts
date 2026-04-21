import { z } from "zod";

/**
 * Acknowledgment marker — surfaced from a Figma Dev Mode annotation that
 * canicode itself wrote during a roundtrip. When the analysis pipeline
 * receives a list of acknowledgments, matching `(nodeId, ruleId)` issues are
 * flagged `acknowledged: true` and contribute half their normal weight to
 * the density score (#371).
 *
 * This contract is consumed by:
 * - The MCP `analyze` tool (`acknowledgments?: Acknowledgment[]` input)
 * - The CLI `analyze --acknowledgments <path>` flag
 * - `RuleEngineOptions.acknowledgments`
 *
 * It is produced by the Plugin-API helper
 * `extractAcknowledgmentsFromNode` / `readCanicodeAcknowledgments`
 * (see `src/core/roundtrip/read-acknowledgments.ts`).
 *
 * ADR-019 / #444: optional `intent`, `sceneWriteOutcome`, and `codegenDirective`
 * are read from a fenced canicode-json block when present; legacy annotations
 * omit them and remain valid for density scoring.
 */
export const AcknowledgmentIntentSchema = z.object({
  field: z.string(),
  value: z.unknown(),
  scope: z.enum(["instance", "definition"]),
});

export type AcknowledgmentIntent = z.infer<typeof AcknowledgmentIntentSchema>;

export const AcknowledgmentSceneWriteOutcomeSchema = z.object({
  result: z.enum([
    "succeeded",
    "silent-ignored",
    "api-rejected",
    "user-declined-propagation",
    "unknown",
  ]),
  reason: z.string().optional(),
});

export type AcknowledgmentSceneWriteOutcome = z.infer<
  typeof AcknowledgmentSceneWriteOutcomeSchema
>;

export const AcknowledgmentSchema = z.object({
  nodeId: z.string(),
  ruleId: z.string(),
  intent: AcknowledgmentIntentSchema.optional(),
  sceneWriteOutcome: AcknowledgmentSceneWriteOutcomeSchema.optional(),
  codegenDirective: z.string().optional(),
});

export type Acknowledgment = z.infer<typeof AcknowledgmentSchema>;

export const AcknowledgmentListSchema = z.array(AcknowledgmentSchema);

/**
 * Normalize a Figma node id into `:`-separated form so callers can pass
 * either URL-style (`123-456`) or Plugin-API-style (`123:456`) ids and the
 * engine matches them consistently. Non-instance ids stay unchanged; the
 * `I…;…` instance-child format keeps its semicolon — only `-` → `:`
 * happens.
 */
export function normalizeNodeId(id: string): string {
  return id.replace(/-/g, ":");
}
