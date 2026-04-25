import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { CAC } from "cac";
import { z } from "zod";

import { GotchaSurveySchema } from "../../core/contracts/gotcha-survey.js";
import { renderGotchaSection } from "../../core/gotcha/render-gotcha-section.js";
import { renderUpsertedFile } from "../../core/gotcha/upsert-gotcha-section.js";

/**
 * Atomic read → upsert → write of the per-design gotcha section into the
 * `canicode-gotchas` SKILL.md. Owns the deterministic markdown parsing
 * the SKILL used to inline as prose (file-state detection, `## #NNN — ...`
 * walking, monotonic numbering) — see ADR-016 and #385 / #439.
 *
 * Inputs:
 * - `--file <path>`: the SKILL.md path. Required.
 * - `--design-key <key>`: canonical design key from `gotcha-survey`'s
 *   response. Required — must match `survey.designKey` inside the JSON.
 * - `--input <path>`: JSON file or `-` for stdin (`--input=-`). Shape:
 *   `{ survey: { designKey, designGrade, questions }, answers, designName,
 *   figmaUrl, analyzedAt, today }`. The CLI renders section markdown via
 *   `renderGotchaSection` so severity / question text cannot drift from the
 *   survey JSON (#439).
 *
 * Outputs (stdout, JSON):
 * ```
 * {
 *   "state": "valid" | "missing" | "missing-heading" | "clobbered",
 *   "action": "replace" | "append" | null,
 *   "sectionNumber": "NNN" | null,
 *   "wrote": true | false,
 *   "userMessage": string | null,
 *   "designKey": string | null
 * }
 * ```
 */
const AnswerSchema = z.union([
  z.object({ answer: z.string() }),
  z.object({ skipped: z.literal(true) }),
]);

const UpsertJsonPayloadSchema = z.object({
  survey: GotchaSurveySchema.pick({
    designKey: true,
    designGrade: true,
    questions: true,
  }),
  answers: z.record(z.string(), AnswerSchema),
  designName: z.string(),
  figmaUrl: z.string(),
  analyzedAt: z.string(),
  today: z.string(),
});

const UpsertOptionsSchema = z.object({
  file: z.string().min(1, "--file is required"),
  designKey: z.string().min(1, "--design-key is required"),
  input: z
    .string()
    .min(1, "--input is required (use '--input=-' to read stdin)"),
});

type UpsertOptions = z.infer<typeof UpsertOptionsSchema>;

interface UpsertCliResult {
  state: string;
  action: "replace" | "append" | null;
  sectionNumber: string | null;
  wrote: boolean;
  userMessage: string | null;
  /** Echo of the canonical design key after JSON validation (audit). */
  designKey: string | null;
}

const USER_MESSAGES: Record<string, string> = {
  missing:
    "Gotchas SKILL.md not found at the given path. Run `canicode init` first, then re-invoke this skill.",
  clobbered:
    "Your gotchas SKILL.md is missing the canicode YAML frontmatter. Run `canicode init --force` to restore the workflow, then re-run this survey.",
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function parseUpsertPayload(rawJson: string): z.infer<typeof UpsertJsonPayloadSchema> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new Error("Invalid JSON in --input");
  }
  const result = UpsertJsonPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid upsert payload: ${msg}`);
  }
  return result.data;
}

export async function runUpsertGotchaSection(
  options: UpsertOptions,
): Promise<UpsertCliResult> {
  const rawJson =
    options.input === "-" ? await readStdin() : readFileSync(options.input, "utf-8");

  const payload = parseUpsertPayload(rawJson);

  if (payload.survey.designKey !== options.designKey) {
    throw new Error(
      `--design-key (${options.designKey}) does not match survey.designKey (${payload.survey.designKey})`,
    );
  }

  const sectionMarkdown = renderGotchaSection({
    questions: payload.survey.questions,
    answers: payload.answers,
    designName: payload.designName,
    figmaUrl: payload.figmaUrl,
    designKey: payload.survey.designKey,
    designGrade: payload.survey.designGrade,
    analyzedAt: payload.analyzedAt,
    today: payload.today,
  });

  const currentContent = existsSync(options.file)
    ? readFileSync(options.file, "utf-8")
    : null;

  const { state, newContent, plan } = renderUpsertedFile({
    currentContent,
    designKey: options.designKey,
    sectionMarkdown,
  });

  if (newContent === null) {
    return {
      state,
      action: null,
      sectionNumber: null,
      wrote: false,
      userMessage: USER_MESSAGES[state] ?? null,
      designKey: payload.survey.designKey,
    };
  }

  writeFileSync(options.file, newContent, "utf-8");
  return {
    state,
    action: plan?.action ?? null,
    sectionNumber: plan?.sectionNumber ?? null,
    wrote: true,
    userMessage: null,
    designKey: payload.survey.designKey,
  };
}

export function registerUpsertGotchaSection(cli: CAC): void {
  cli
    .command(
      "upsert-gotcha-section",
      "Upsert a per-design section into the canicode-gotchas SKILL.md (used by the canicode-gotchas skill — Step 4b)",
    )
    .option("--file <path>", "Path to the canicode-gotchas SKILL.md")
    .option(
      "--design-key <key>",
      "Canonical design key from gotcha-survey's response",
    )
    .option(
      "--input <path>",
      "JSON payload path, or '--input=-' to read JSON from stdin (cac parses a bare '-' as a flag, so the '=' form is required).",
    )
    .action(async (rawOptions: Record<string, unknown>) => {
      const parseResult = UpsertOptionsSchema.safeParse(rawOptions);
      if (!parseResult.success) {
        const msg = parseResult.error.issues
          .map((i) => `--${i.path.join(".")}: ${i.message}`)
          .join("\n");
        console.error(`\nInvalid options:\n${msg}`);
        process.exit(1);
      }

      try {
        const result = await runUpsertGotchaSection(parseResult.data);
        console.log(JSON.stringify(result, null, 2));
        if (!result.wrote && result.userMessage) {
          process.exitCode = 2;
        }
      } catch (error) {
        console.error(
          "\nError:",
          error instanceof Error ? error.message : String(error),
        );
        process.exitCode = 1;
      }
    });
}
