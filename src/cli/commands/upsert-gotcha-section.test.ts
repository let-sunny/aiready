import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import cac from "cac";
import { GotchaSurveyQuestionSchema } from "../../core/contracts/gotcha-survey.js";

import {
  registerUpsertGotchaSection,
  runUpsertGotchaSection,
} from "./upsert-gotcha-section.js";

let tempRoot: string;

const FRONTMATTER = [
  "---",
  "name: canicode-gotchas",
  "description: Gotcha survey workflow",
  "---",
  "",
  "# CanICode Gotchas",
  "",
  "Workflow prose here…",
  "",
  "# Collected Gotchas",
  "",
].join("\n");

const minimumQuestion = {
  nodeId: "42:99",
  nodeName: "Settings Frame",
  ruleId: "missing-size-constraint",
  detection: "rule-based" as const,
  outputChannel: "annotation" as const,
  persistenceIntent: "durable" as const,
  purpose: "violation" as const,
  severity: "risk" as const,
  question: "Survey question verbatim?",
  hint: "hint",
  example: "ex",
  applyStrategy: "annotation" as const,
  isInstanceChild: false,
};

function buildUpsertPayload(overrides: {
  designKey?: string;
  designGrade?: string;
  questions?: Array<ReturnType<typeof GotchaSurveyQuestionSchema.parse>>;
  answers?: Record<string, { answer: string } | { skipped: true }>;
} = {}) {
  const q = GotchaSurveyQuestionSchema.parse(minimumQuestion);
  const questions = overrides.questions ?? [q];
  const dk = overrides.designKey ?? "abc#1:1";

  return {
    survey: {
      designKey: dk,
      designGrade: overrides.designGrade ?? "B",
      questions,
    },
    answers:
      overrides.answers ??
      ({
        [questions[0]!.nodeId]: { answer: "yes" },
      } as Record<string, { answer: string } | { skipped: true }>),
    designName: "Settings",
    figmaUrl: "https://figma.com/design/x",
    analyzedAt: "2026-04-22T12:00:00.000Z",
    today: "2026-04-20",
  };
}

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "canicode-upsert-"));
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("runUpsertGotchaSection", () => {
  it("appends a new section and writes the file when state is valid", async () => {
    const file = join(tempRoot, "SKILL.md");
    writeFileSync(file, FRONTMATTER, "utf-8");

    const payload = buildUpsertPayload();
    const payloadPath = join(tempRoot, "payload.json");
    writeFileSync(payloadPath, JSON.stringify(payload), "utf-8");

    const result = await runUpsertGotchaSection({
      file,
      designKey: "abc#1:1",
      input: payloadPath,
    });

    expect(result.wrote).toBe(true);
    expect(result.designKey).toBe("abc#1:1");
    expect(result.action).toBe("append");
    expect(result.sectionNumber).toBe("001");
    expect(result.userMessage).toBeNull();

    const onDisk = readFileSync(file, "utf-8");
    expect(onDisk).toContain("## #001 — Settings");
    expect(onDisk).toContain("Workflow prose here…");
  });

  it("severity on disk equals survey JSON severity (byte-for-byte)", async () => {
    const file = join(tempRoot, "SKILL.md");
    writeFileSync(file, FRONTMATTER, "utf-8");

    const q = GotchaSurveyQuestionSchema.parse({
      ...minimumQuestion,
      severity: "missing-info",
      nodeId: "1:2",
    });
    const payload = buildUpsertPayload({
      designKey: "dk#x",
      designGrade: "A",
      questions: [q],
      answers: { "1:2": { answer: "detail" } },
    });
    const payloadPath = join(tempRoot, "payload.json");
    writeFileSync(payloadPath, JSON.stringify(payload), "utf-8");

    await runUpsertGotchaSection({
      file,
      designKey: "dk#x",
      input: payloadPath,
    });

    const onDisk = readFileSync(file, "utf-8");
    expect(onDisk).toContain("- **Severity**: missing-info");
    expect(onDisk).not.toContain("- **Severity**: Missing Info");
  });

  it("returns missing state without writing when the file does not exist", async () => {
    const file = join(tempRoot, "missing.md");
    const payloadPath = join(tempRoot, "payload.json");
    writeFileSync(payloadPath, JSON.stringify(buildUpsertPayload()), "utf-8");

    const result = await runUpsertGotchaSection({
      file,
      designKey: "abc#1:1",
      input: payloadPath,
    });

    expect(result.wrote).toBe(false);
    expect(result.state).toBe("missing");
    expect(result.designKey).toBe("abc#1:1");
    expect(result.action).toBeNull();
    expect(result.userMessage).toContain("canicode init");
  });

  it("returns clobbered state without writing when frontmatter is missing", async () => {
    const file = join(tempRoot, "SKILL.md");
    writeFileSync(file, "# Single-design content\n\n- **Design key**: x\n", "utf-8");
    const payloadPath = join(tempRoot, "payload.json");
    writeFileSync(payloadPath, JSON.stringify(buildUpsertPayload()), "utf-8");

    const result = await runUpsertGotchaSection({
      file,
      designKey: "abc#1:1",
      input: payloadPath,
    });

    expect(result.wrote).toBe(false);
    expect(result.state).toBe("clobbered");
    expect(result.userMessage).toContain("canicode init --force");

    expect(readFileSync(file, "utf-8")).toBe(
      "# Single-design content\n\n- **Design key**: x\n",
    );
  });

  it("parses --input=- through cac (SKILL.md invocation shape)", () => {
    const cli = cac("canicode");
    registerUpsertGotchaSection(cli);
    const parsed = cli.parse(
      [
        "node",
        "canicode",
        "upsert-gotcha-section",
        "--file",
        "/tmp/does-not-matter.md",
        "--design-key",
        "abc#1:1",
        "--input=-",
      ],
      { run: false },
    );

    expect(parsed.options.input).toBe("-");
    expect(parsed.options.file).toBe("/tmp/does-not-matter.md");
    expect(parsed.options.designKey).toBe("abc#1:1");
  });

  it("preserves NNN on replace by Design key match", async () => {
    const file = join(tempRoot, "SKILL.md");
    const seeded =
      FRONTMATTER +
      "## #003 — Old Title — 2026-04-01\n\n- **Design key**: keep-me\n\n";
    writeFileSync(file, seeded, "utf-8");

    const payload = buildUpsertPayload({
      designKey: "keep-me",
      designGrade: "C",
      questions: [
        GotchaSurveyQuestionSchema.parse({
          ...minimumQuestion,
          nodeId: "9:9",
        }),
      ],
      answers: { "9:9": { answer: "ok" } },
    });
    const payloadPath = join(tempRoot, "payload.json");
    writeFileSync(payloadPath, JSON.stringify(payload), "utf-8");

    const result = await runUpsertGotchaSection({
      file,
      designKey: "keep-me",
      input: payloadPath,
    });

    expect(result.wrote).toBe(true);
    expect(result.action).toBe("replace");
    expect(result.sectionNumber).toBe("003");

    const onDisk = readFileSync(file, "utf-8");
    expect(onDisk).toContain("## #003 — Settings");
    expect(onDisk).not.toContain("Old Title");
  });

  it("rejects design-key mismatch between flag and JSON", async () => {
    const file = join(tempRoot, "SKILL.md");
    writeFileSync(file, FRONTMATTER, "utf-8");
    const payloadPath = join(tempRoot, "payload.json");
    writeFileSync(payloadPath, JSON.stringify(buildUpsertPayload()), "utf-8");

    await expect(
      runUpsertGotchaSection({
        file,
        designKey: "wrong-key",
        input: payloadPath,
      }),
    ).rejects.toThrow("does not match survey.designKey");
  });
});
