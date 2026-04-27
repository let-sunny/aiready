import { z } from "zod";

export const SeveritySchema = z.enum([
  "blocking",
  "risk",
  "missing-info",
  "suggestion",
  /**
   * `note` is the zero-impact tier (#519): findings render in the report but
   * never move the grade. Used for annotation-primary rules whose value is the
   * nudge, not the score (e.g. unmapped Code Connect components, info-collection
   * rules whose answers belong in figma-implement-design context, not in linting).
   */
  "note",
]);

export type Severity = z.infer<typeof SeveritySchema>;

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  blocking: 10,
  risk: 5,
  "missing-info": 2,
  suggestion: 1,
  note: 0,
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  blocking: "Blocking",
  risk: "Risk",
  "missing-info": "Missing Info",
  suggestion: "Suggestion",
  note: "Note",
};
