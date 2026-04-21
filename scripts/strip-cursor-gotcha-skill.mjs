#!/usr/bin/env node
/**
 * Emit `skills/cursor/canicode-gotchas/SKILL.md` from the canonical gotchas skill.
 * Cursor installs this copy under `.cursor/skills/`; answers still upsert only to
 * `.claude/skills/canicode-gotchas/SKILL.md`, so the Collected Gotchas region is
 * omitted here to avoid a stale duplicate (issue #407, single-source follow-up).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const canonical = join(root, ".claude/skills/canicode-gotchas/SKILL.md");
const outPath = join(root, "skills/cursor/canicode-gotchas/SKILL.md");

const raw = readFileSync(canonical, "utf8");
const marker = "\n# Collected Gotchas";
const idx = raw.indexOf(marker);
const body = idx >= 0 ? `${raw.slice(0, idx).trimEnd()}\n` : `${raw.trimEnd()}\n`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, body, "utf8");
