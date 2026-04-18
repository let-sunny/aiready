import {
  existsSync, mkdirSync, readdirSync, statSync, copyFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const InstallSkillsOptionsSchema = z.object({
  target: z.enum(["project", "global"]),
  force: z.boolean(),
  cwd: z.string().optional(),
  sourceDir: z.string().optional(),
});

export type InstallSkillsOptions = z.input<typeof InstallSkillsOptionsSchema>;

export interface InstallSummary {
  installed: string[];
  overwritten: string[];
  skipped: string[];
  targetDir: string;
}

const SKILL_NAMES = ["canicode", "canicode-gotchas", "canicode-roundtrip"] as const;

// Resolve the bundled `skills/` dir at runtime. tsup bundles this module
// into the CLI entrypoint `<pkg>/dist/cli/index.js` (splitting: false), so
// `import.meta.url` at runtime resolves to that entrypoint — depth 2 under
// the package root. `../../skills/` therefore lands on `<pkg>/skills/`.
// If tsup's output layout ever changes (new entrypoint depth, splitting
// enabled, etc.), update this URL.
function defaultSourceDir(): string {
  return fileURLToPath(new URL("../../skills/", import.meta.url));
}

export async function installSkills(rawOptions: InstallSkillsOptions): Promise<InstallSummary> {
  const options = InstallSkillsOptionsSchema.parse(rawOptions);
  const sourceDir = options.sourceDir ?? defaultSourceDir();

  if (!existsSync(sourceDir)) {
    throw new Error(
      `Bundled skills directory not found: ${sourceDir}\n` +
      `If you are developing canicode, run 'pnpm build' first.\n` +
      `If you installed canicode from npm, please file a bug report — the tarball is missing skills/.`,
    );
  }

  const cwd = options.cwd ?? process.cwd();
  const targetDir = options.target === "global"
    ? join(homedir(), ".claude", "skills")
    : join(cwd, ".claude", "skills");

  mkdirSync(targetDir, { recursive: true });

  const summary: InstallSummary = {
    installed: [],
    overwritten: [],
    skipped: [],
    targetDir,
  };

  type Action = "install" | "force-overwrite" | "needs-decision";
  interface Op {
    src: string;
    dest: string;
    label: string;
    action: Action;
  }
  const ops: Op[] = [];

  for (const skillName of SKILL_NAMES) {
    const srcSkillDir = join(sourceDir, skillName);
    if (!existsSync(srcSkillDir)) {
      throw new Error(`Bundled skill directory missing: ${srcSkillDir}`);
    }

    const destSkillDir = join(targetDir, skillName);
    mkdirSync(destSkillDir, { recursive: true });

    const files = listFilesRecursive(srcSkillDir);
    for (const relPath of files) {
      const src = join(srcSkillDir, relPath);
      const dest = join(destSkillDir, relPath);
      mkdirSync(dirname(dest), { recursive: true });

      const label = join(skillName, relPath);
      let action: Action;
      if (!existsSync(dest)) {
        action = "install";
      } else if (options.force) {
        action = "force-overwrite";
      } else {
        action = "needs-decision";
      }
      ops.push({ src, dest, label, action });
    }
  }

  const candidates = ops.filter(op => op.action === "needs-decision");
  const decisions = candidates.length > 0
    ? await promptOverwriteBatch(candidates.map(op => ({ label: op.label, dest: op.dest })))
    : new Map<string, "overwrite" | "skip">();

  for (const op of ops) {
    if (op.action === "install") {
      copyFileSync(op.src, op.dest);
      summary.installed.push(op.label);
    } else if (op.action === "force-overwrite") {
      copyFileSync(op.src, op.dest);
      summary.overwritten.push(op.label);
    } else {
      const decision = decisions.get(op.label) ?? "skip";
      if (decision === "overwrite") {
        copyFileSync(op.src, op.dest);
        summary.overwritten.push(op.label);
      } else {
        summary.skipped.push(op.label);
      }
    }
  }

  return summary;
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        out.push(relative(dir, full));
      }
    }
  };
  walk(dir);
  return out;
}

async function promptOverwriteBatch(
  candidates: Array<{ label: string; dest: string }>,
): Promise<Map<string, "overwrite" | "skip">> {
  const decisions = new Map<string, "overwrite" | "skip">();

  // Non-interactive (CI, piped stdin): default to skip — safer than silently
  // clobbering a user-edited skill file. Users who want unattended overwrite
  // pass --force.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    for (const { label } of candidates) {
      decisions.set(label, "skip");
    }
    return decisions;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    let mode: "ask" | "all" | "none" = "ask";
    for (const { label, dest } of candidates) {
      if (mode === "all") {
        decisions.set(label, "overwrite");
        continue;
      }
      if (mode === "none") {
        decisions.set(label, "skip");
        continue;
      }
      const answer = (await rl.question(
        `File exists: ${dest}. Overwrite? [y/N/a=all/s=skip-all] `,
      )).trim().toLowerCase();
      if (answer === "a") {
        decisions.set(label, "overwrite");
        mode = "all";
      } else if (answer === "s") {
        decisions.set(label, "skip");
        mode = "none";
      } else if (answer.startsWith("y")) {
        decisions.set(label, "overwrite");
      } else {
        decisions.set(label, "skip");
      }
    }
  } finally {
    rl.close();
  }
  return decisions;
}
