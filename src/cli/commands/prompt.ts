import type { CAC } from "cac";

export function registerPrompt(cli: CAC): void {
  cli
    .command("prompt", "Output the standard design-to-code prompt for AI code generation")
    .action(async () => {
      try {
        const { readFile } = await import("node:fs/promises");
        const { dirname: dirnameFn, resolve: resolveFn } = await import("node:path");
        const { fileURLToPath } = await import("node:url");
        const __dirname = dirnameFn(fileURLToPath(import.meta.url));
        // Try from source location first, then npm-installed location
        const paths = [
          resolveFn(__dirname, "../../.claude/skills/design-to-code/PROMPT.md"),
          resolveFn(__dirname, "../.claude/skills/design-to-code/PROMPT.md"),
        ];
        for (const p of paths) {
          try {
            const content = await readFile(p, "utf-8");
            console.log(content);
            return;
          } catch { /* try next */ }
        }
        console.error("Prompt file not found");
        process.exitCode = 1; return;
      } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}
