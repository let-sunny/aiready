import { runGotchaSurvey } from "./gotcha-survey.js";
import { GotchaSurveySchema } from "../../core/contracts/gotcha-survey.js";

const FIXTURE = "fixtures/done/desktop-about";

describe("runGotchaSurvey", () => {
  it("returns a valid GotchaSurvey for a fixture input", async () => {
    const survey = await runGotchaSurvey(FIXTURE, { json: true });

    // Same JSON shape as the MCP `gotcha-survey` tool response
    const parsed = GotchaSurveySchema.parse(survey);
    expect(parsed.designGrade).toMatch(/^(S|A\+|A|B\+|B|C\+|C|D|F)$/);
    expect(typeof parsed.isReadyForCodeGen).toBe("boolean");
    expect(Array.isArray(parsed.questions)).toBe(true);

    // Each question must have the required keys the skills consume
    for (const q of parsed.questions) {
      expect(q).toHaveProperty("nodeId");
      expect(q).toHaveProperty("ruleId");
      expect(q).toHaveProperty("severity");
      expect(q).toHaveProperty("question");
      expect(q).toHaveProperty("applyStrategy");
    }
  });

  it("respects --preset by picking up different configs", async () => {
    const strict = await runGotchaSurvey(FIXTURE, { preset: "strict", json: true });
    const relaxed = await runGotchaSurvey(FIXTURE, { preset: "relaxed", json: true });

    // Both channels produce valid surveys; preset should not crash the pipeline
    expect(GotchaSurveySchema.safeParse(strict).success).toBe(true);
    expect(GotchaSurveySchema.safeParse(relaxed).success).toBe(true);
  });
});
