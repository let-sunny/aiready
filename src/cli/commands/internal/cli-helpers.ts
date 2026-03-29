import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

export const RUN_DIR_ARG_SCHEMA = z.string().trim().min(1, "runDir is required");
export const KEYWORD_ARG_SCHEMA = z.string().trim().min(1, "keyword is required");

/**
 * Validate and resolve a run directory path.
 * Returns the resolved absolute path, or null if invalid/missing/not a directory.
 * Logs to stdout and returns null on failure (internal CLI convention).
 */
export function resolveRunDir(runDir: string): string | null {
  const parsed = RUN_DIR_ARG_SCHEMA.safeParse(runDir);
  if (!parsed.success) {
    console.log(`Invalid runDir: ${parsed.error.issues[0]?.message}`);
    return null;
  }
  const dir = resolve(parsed.data);
  try {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      console.log(`Run directory not found or is not a directory: ${runDir}`);
      return null;
    }
  } catch {
    console.log(`Run directory not accessible: ${runDir}`);
    return null;
  }
  return dir;
}
