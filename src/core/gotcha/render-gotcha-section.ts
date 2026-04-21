/**
 * Deterministic rendering of the per-design gotcha section markdown for
 * `.claude/skills/canicode-gotchas/SKILL.md` — see Output Template in that
 * SKILL and ADR-016 / issue #439.
 *
 * Severity, ruleId, nodeId, nodeName, question text, and instanceContext
 * fields are copied verbatim from the survey JSON; only layout bullets are
 * synthesized. `{{SECTION_NUMBER}}` stays literal for `renderUpsertedFile`.
 */
import { z } from "zod";

import {
  GotchaSurveyQuestionSchema,
  type GotchaSurveyQuestion,
} from "../contracts/gotcha-survey.js";

const AnswersMapSchema = z.record(
  z.string(),
  z.union([
    z.object({ answer: z.string() }),
    z.object({ skipped: z.literal(true) }),
  ]),
);

export const RenderGotchaSectionInputSchema = z.object({
  questions: z.array(GotchaSurveyQuestionSchema),
  answers: AnswersMapSchema,
  designName: z.string(),
  figmaUrl: z.string(),
  designKey: z.string(),
  designGrade: z.string(),
  analyzedAt: z.string(),
  /** Local date for the section header (`YYYY-MM-DD`). */
  today: z.string(),
});

export type RenderGotchaSectionInput = z.infer<
  typeof RenderGotchaSectionInputSchema
>;

function formatAnswerLine(
  nodeId: string,
  answers: RenderGotchaSectionInput["answers"],
): string {
  const v = answers[nodeId];
  if (v === undefined) return "_(skipped)_";
  if ("skipped" in v && v.skipped === true) return "_(skipped)_";
  return "answer" in v ? v.answer : "_(skipped)_";
}

function renderInstanceContextBullet(q: GotchaSurveyQuestion): string | null {
  const ic = q.instanceContext;
  if (!ic) return null;

  let componentPart = "";
  if (ic.sourceComponentName !== undefined && ic.sourceComponentId !== undefined) {
    componentPart = `, component \`${ic.sourceComponentName}\` / \`${ic.sourceComponentId}\``;
  } else if (ic.sourceComponentName !== undefined) {
    componentPart = `, component \`${ic.sourceComponentName}\``;
  } else if (ic.sourceComponentId !== undefined) {
    componentPart = `, component \`${ic.sourceComponentId}\``;
  }

  return `- **Instance context**: parent instance \`${ic.parentInstanceNodeId}\`, source node \`${ic.sourceNodeId}\`${componentPart} — roundtrip apply uses this to write on the source definition when instance overrides fail.`;
}

/**
 * Produce Output-Template-shaped markdown with `{{SECTION_NUMBER}}` in the
 * first heading line.
 */
export function renderGotchaSection(raw: RenderGotchaSectionInput): string {
  const input = RenderGotchaSectionInputSchema.parse(raw);

  const header = [
    `## #{{SECTION_NUMBER}} — ${input.designName} — ${input.today}`,
    "",
    `- **Figma URL**: ${input.figmaUrl}`,
    `- **Design key**: ${input.designKey}`,
    `- **Grade**: ${input.designGrade}`,
    `- **Analyzed at**: ${input.analyzedAt}`,
    "",
    "### Gotchas",
    "",
  ].join("\n");

  const blocks: string[] = [];
  for (const q of input.questions) {
    const lines: string[] = [
      `#### ${q.ruleId} — ${q.nodeName}`,
      "",
      `- **Severity**: ${q.severity}`,
      `- **Node ID**: ${q.nodeId}`,
    ];

    const icBullet = renderInstanceContextBullet(q);
    if (icBullet !== null) {
      lines.push(icBullet);
    }

    lines.push(
      `- **Question**: ${q.question}`,
      `- **Answer**: ${formatAnswerLine(q.nodeId, input.answers)}`,
      "",
    );
    blocks.push(lines.join("\n"));
  }

  return `${header}${blocks.join("")}`.replace(/\s+$/, "") + "\n";
}
