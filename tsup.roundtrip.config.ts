import { defineConfig } from "tsup";

// IIFE bundle of the deterministic roundtrip helpers. The emitted file is
// Read by the canicode-roundtrip SKILL and prepended into every `use_figma`
// JS batch — it runs inside Figma's Plugin sandbox, so the build must be
// self-contained with no imports and all helpers exposed on a single global
// (`CanICodeRoundtrip.*`). Not minified: debuggability in the Plugin console
// matters more than size. The payload is currently ~31KB — well above the old
// ~1KB estimate — which is why `scripts/bundle-roundtrip-cache.ts` runs as a
// post-build step and emits two sibling artifacts (`helpers-installer.js`
// + `helpers-bootstrap.js`) for the setSharedPluginData cache path that keeps
// per-batch payload below use_figma's ~50KB budget (#424, ADR-020).
export default defineConfig({
  entry: { helpers: "src/core/roundtrip/index.ts" },
  format: ["iife"],
  globalName: "CanICodeRoundtrip",
  platform: "browser",
  outDir: ".claude/skills/canicode-roundtrip",
  dts: false,
  clean: false,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  target: "es2020",
  noExternal: [/.*/],
  minify: false,
  outExtension() {
    return { js: ".js" };
  },
});
