/**
 * Fixture file helpers.
 * Shared by calibration pipeline and experiment scripts.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Get design-tree generation options (vectorDir, imageDir) for a fixture.
 */
export function getDesignTreeOptions(fixture: string) {
  const fixtureDir = resolve(`fixtures/${fixture}`);
  const vectorDir = join(fixtureDir, "vectors");
  const imageDir = join(fixtureDir, "images");
  return {
    ...(existsSync(vectorDir) ? { vectorDir } : {}),
    ...(existsSync(imageDir) ? { imageDir } : {}),
  };
}

/**
 * Get the screenshot path for a fixture at a given width.
 * Desktop fixtures default to 1200px, mobile to 375px.
 */
export function getFixtureScreenshotPath(fixture: string, width?: number): string {
  const w = width ?? (fixture.startsWith("mobile-") ? 375 : 1200);
  return resolve(`fixtures/${fixture}/screenshot-${w}.png`);
}

/**
 * Copy fixture images to a run directory (for local rendering with image references).
 */
export function copyFixtureImages(fixture: string, runDir: string): void {
  const fixtureImagesDir = resolve(`fixtures/${fixture}/images`);
  if (existsSync(fixtureImagesDir)) {
    const runImagesDir = join(runDir, "images");
    mkdirSync(runImagesDir, { recursive: true });
    for (const f of readdirSync(fixtureImagesDir)) {
      copyFileSync(join(fixtureImagesDir, f), join(runImagesDir, f));
    }
  }
}
