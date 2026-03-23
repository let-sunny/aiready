import { existsSync, mkdirSync } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

export interface ActivityStep {
  step: string;
  nodePath?: string;
  result: string;
  durationMs: number;
}

function getIsoTimestamp(): string {
  return new Date().toISOString();
}

export class ActivityLogger {
  private logPath: string;
  private initialized = false;

  constructor(runDir: string) {
    this.logPath = resolve(join(runDir, "activity.jsonl"));
  }

  /**
   * Ensure the log directory and file header exist
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const dir = resolve(this.logPath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (!existsSync(this.logPath)) {
      // Write the initial "session-start" entry as the first JSON line
      const entry = {
        step: "session-start",
        timestamp: getIsoTimestamp(),
        result: "Calibration activity log initialized",
        durationMs: 0,
      };
      await writeFile(this.logPath, JSON.stringify(entry) + "\n", "utf-8");
    }

    this.initialized = true;
  }

  /**
   * Log a pipeline step as a JSON Lines entry
   */
  async logStep(activity: ActivityStep): Promise<void> {
    await this.ensureInitialized();

    const entry: Record<string, unknown> = {
      step: activity.step,
      timestamp: getIsoTimestamp(),
      result: activity.result,
      durationMs: activity.durationMs,
    };

    if (activity.nodePath !== undefined) {
      entry["nodePath"] = activity.nodePath;
    }

    await appendFile(this.logPath, JSON.stringify(entry) + "\n", "utf-8");
  }

  /**
   * Log a summary at pipeline completion as a JSON Lines entry
   */
  async logSummary(summary: {
    totalDurationMs: number;
    nodesAnalyzed: number;
    nodesConverted: number;
    mismatches: number;
    adjustments: number;
    status: string;
  }): Promise<void> {
    await this.ensureInitialized();

    const entry = {
      step: "Pipeline Summary",
      timestamp: getIsoTimestamp(),
      result: summary.status,
      durationMs: summary.totalDurationMs,
      nodesAnalyzed: summary.nodesAnalyzed,
      nodesConverted: summary.nodesConverted,
      mismatches: summary.mismatches,
      adjustments: summary.adjustments,
    };

    await appendFile(this.logPath, JSON.stringify(entry) + "\n", "utf-8");
  }

  getLogPath(): string {
    return this.logPath;
  }
}
