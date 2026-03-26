import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RULE_CONFIGS } from "./rule-config.js";
import { ruleRegistry } from "./rule-registry.js";
import { CATEGORIES } from "../contracts/category.js";
import type { Category } from "../contracts/category.js";
import type { RuleId } from "../contracts/rule.js";

// Import all rules to populate registry
import "./index.js";

const REFERENCE_PATH = resolve(import.meta.dirname, "../../../docs/REFERENCE.md");

describe("rule-config sync", () => {
  describe("REFERENCE.md matches rule-config.ts", () => {
    const content = readFileSync(REFERENCE_PATH, "utf-8");

    // Parse rule tables from REFERENCE.md
    const tableRows = [...content.matchAll(/\| `([^`]+)` \| (-?\d+) \| ([a-z-]+) \|/g)];
    const docRules = new Map(
      tableRows.map((m) => [m[1]!, { score: Number(m[2]), severity: m[3]! }])
    );

    for (const [id, config] of Object.entries(RULE_CONFIGS)) {
      it(`${id}: score matches`, () => {
        const doc = docRules.get(id);
        expect(doc).toBeDefined();
        expect(doc!.score).toBe(config.score);
      });

      it(`${id}: severity matches`, () => {
        const doc = docRules.get(id);
        expect(doc).toBeDefined();
        expect(doc!.severity).toBe(config.severity);
      });
    }

    it("REFERENCE.md has no extra rules beyond rule-config.ts", () => {
      const configIds = new Set(Object.keys(RULE_CONFIGS));
      for (const docId of docRules.keys()) {
        expect(configIds.has(docId)).toBe(true);
      }
    });

    it("REFERENCE.md has all rules from rule-config.ts", () => {
      for (const id of Object.keys(RULE_CONFIGS)) {
        expect(docRules.has(id)).toBe(true);
      }
    });
  });

  describe("rule registry covers all rule-config.ts entries", () => {
    it("every RULE_CONFIGS entry has a registered rule", () => {
      for (const id of Object.keys(RULE_CONFIGS)) {
        expect(ruleRegistry.has(id as RuleId)).toBe(true);
      }
    });

    it("every registered rule has a RULE_CONFIGS entry", () => {
      for (const rule of ruleRegistry.getAll()) {
        expect(RULE_CONFIGS[rule.definition.id as RuleId]).toBeDefined();
      }
    });
  });

  describe("rules/index.ts comments match actual counts", () => {
    const indexContent = readFileSync(
      resolve(import.meta.dirname, "./index.ts"),
      "utf-8"
    );

    for (const category of CATEGORIES) {
      it(`${category} rule count is correct`, () => {
        const rules = ruleRegistry.getByCategory(category as Category);
        const match = indexContent.match(
          new RegExp(`// .+rules.+\\(${rules.length}\\).*\\n.*${category}`)
        );
        // If there's a count comment, it must match actual count
        const countMatch = indexContent.match(
          new RegExp(`${category}.*rules.*\\((\\d+)\\)`, "i")
        );
        if (countMatch) {
          expect(Number(countMatch[1])).toBe(rules.length);
        }
      });
    }
  });
});
