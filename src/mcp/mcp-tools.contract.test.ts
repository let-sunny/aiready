import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * MCP tool names are part of the public contract for MCP hosts (Cursor, Claude Desktop, etc.).
 * Renaming a tool is a breaking change for stored configs and agent skills — bump major or keep aliases.
 */
describe("MCP tool registry contract", () => {
  it("registers gotcha-survey for Cursor and other MCP clients (issue #407)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const serverSrc = readFileSync(join(here, "server.ts"), "utf-8");
    expect(serverSrc).toContain('  "gotcha-survey",');
  });
});
