import type { CAC } from "cac";

import type { RuleConfig } from "../../core/contracts/rule.js";
import { RULE_CONFIGS } from "../../core/rules/rule-config.js";
import { ruleRegistry } from "../../core/rules/rule-registry.js";
import { loadCustomRules } from "../../core/rules/custom/custom-rule-loader.js";
import { loadConfigFile, mergeConfigs } from "../../core/rules/custom/config-loader.js";

interface ListRulesOptions {
  customRules?: string;
  config?: string;
  json?: boolean;
}

export function registerListRules(cli: CAC): void {
  cli
    .command("list-rules", "List all analysis rules with scores and severity")
    .option("--custom-rules <path>", "Include custom rules from JSON file")
    .option("--config <path>", "Apply config overrides to show effective scores")
    .option("--json", "Output as JSON")
    .action(async (options: ListRulesOptions) => {
      try {
        let configs: Record<string, RuleConfig> = { ...RULE_CONFIGS };

        if (options.config) {
          const configFile = await loadConfigFile(options.config);
          configs = mergeConfigs(configs, configFile);
        }

        if (options.customRules) {
          const { rules, configs: customConfigs } = await loadCustomRules(options.customRules);
          for (const rule of rules) {
            ruleRegistry.register(rule);
          }
          configs = { ...configs, ...customConfigs };
        }

        const rules = ruleRegistry.getAll().map((rule) => {
          const config = configs[rule.definition.id as string];
          return {
            id: rule.definition.id,
            name: rule.definition.name,
            category: rule.definition.category,
            severity: config?.severity ?? "risk",
            score: config?.score ?? 0,
            enabled: config?.enabled ?? true,
          };
        });

        if (options.json) {
          console.log(JSON.stringify(rules, null, 2));
          return;
        }

        // Group by category
        const byCategory = new Map<string, typeof rules>();
        for (const rule of rules) {
          const list = byCategory.get(rule.category) ?? [];
          list.push(rule);
          byCategory.set(rule.category, list);
        }

        for (const [category, catRules] of byCategory) {
          console.log(`\n  ${category.toUpperCase()}`);
          for (const r of catRules) {
            const status = r.enabled ? "" : " (disabled)";
            const pad = " ".repeat(Math.max(0, 40 - r.id.length));
            console.log(`    ${r.id}${pad} ${String(r.score).padStart(4)}  ${r.severity}${status}`);
          }
        }
        console.log(`\n  Total: ${rules.length} rules\n`);
      } catch (error) {
        console.error(
          "\nError:",
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });
}
