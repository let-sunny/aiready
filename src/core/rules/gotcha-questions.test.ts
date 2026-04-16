import { RULE_CONFIGS } from "./rule-config.js";
import {
  GOTCHA_QUESTIONS,
  GotchaQuestionSchema,
  getGotchaQuestion,
  formatGotchaQuestion,
} from "./gotcha-questions.js";
import type { RuleId } from "../contracts/rule.js";

describe("gotcha-questions", () => {
  const ruleIds = Object.keys(RULE_CONFIGS) as RuleId[];

  it("covers all rule IDs from rule-config.ts", () => {
    const gotchaIds = new Set(Object.keys(GOTCHA_QUESTIONS));
    for (const id of ruleIds) {
      expect(gotchaIds.has(id)).toBe(true);
    }
  });

  it("has no extra entries beyond rule-config.ts", () => {
    const configIds = new Set(ruleIds);
    for (const id of Object.keys(GOTCHA_QUESTIONS)) {
      expect(configIds.has(id)).toBe(true);
    }
  });

  it("each entry has matching ruleId field", () => {
    for (const [id, entry] of Object.entries(GOTCHA_QUESTIONS)) {
      expect(entry.ruleId).toBe(id);
    }
  });

  it("each entry passes Zod schema validation", () => {
    for (const entry of Object.values(GOTCHA_QUESTIONS)) {
      expect(() => GotchaQuestionSchema.parse(entry)).not.toThrow();
    }
  });

  it("each question contains {nodeName} placeholder", () => {
    for (const [id, entry] of Object.entries(GOTCHA_QUESTIONS)) {
      expect(entry.question).toContain("{nodeName}");
    }
  });

  it("each entry has non-empty hint and example", () => {
    for (const entry of Object.values(GOTCHA_QUESTIONS)) {
      expect(entry.hint.length).toBeGreaterThan(0);
      expect(entry.example.length).toBeGreaterThan(0);
    }
  });

  describe("getGotchaQuestion", () => {
    it("returns the correct entry for a given ruleId", () => {
      const result = getGotchaQuestion("no-auto-layout");
      expect(result.ruleId).toBe("no-auto-layout");
      expect(result.question).toContain("{nodeName}");
    });
  });

  describe("formatGotchaQuestion", () => {
    it("replaces {nodeName} placeholder with actual name", () => {
      const result = formatGotchaQuestion("no-auto-layout", "Hero Section");
      expect(result).toContain("Hero Section");
      expect(result).not.toContain("{nodeName}");
    });
  });
});
