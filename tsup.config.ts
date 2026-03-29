import { defineConfig } from "tsup";
import { readFileSync } from "fs";

const reportCss = readFileSync("app/shared/styles.css", "utf-8");

export default defineConfig({
  entry: ["src/index.ts", "src/cli/index.ts", "src/mcp/server.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  target: "node18",
  external: ["playwright"],
  define: {
    __POSTHOG_API_KEY__: JSON.stringify(process.env.POSTHOG_API_KEY ?? ""),
    __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN ?? ""),
    __REPORT_CSS__: JSON.stringify(reportCss),
  },
});
