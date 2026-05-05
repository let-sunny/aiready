import { defineConfig } from "tsup";

// Browser bundle for the analysis engine. The IIFE that tsup emits depends
// on Node-only globals (`fs$1`, `path`) because tsup's IIFE wrapper
// externalises Node built-ins regardless of `platform: "browser"`. Hosts
// that pre-declare those globals must do so before the bundle executes —
// see `app/figma-plugin/src/ui.template.html` for the Figma-plugin shim.
// Rules that touch the stubbed APIs guard at the call site
// (see `src/core/rules/component/index.ts`).
export default defineConfig({
  entry: { browser: "src/browser.ts" },
  format: ["iife"],
  globalName: "CanICode",
  platform: "browser",
  outDir: "app/web/dist",
  dts: false,
  clean: false,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  target: "es2020",
  noExternal: [/.*/],
  minify: true,
});
