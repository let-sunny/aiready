import { bundleRoundtripCache } from "./bundle-roundtrip-cache.js";
import {
  CANICODE_PLUGIN_DATA_NAMESPACE,
  HELPERS_SRC_KEY,
  HELPERS_VERSION_KEY,
} from "../src/core/roundtrip/shared-plugin-data.js";

describe("bundleRoundtripCache", () => {
  const helpersSource = "var CanICodeRoundtrip = { version: 'fake' };";
  const version = "9.9.9";
  const bridgeSuffix =
    "\n;globalThis.CanICodeRoundtrip = CanICodeRoundtrip;\n";
  const bridgedHelpersSource = helpersSource + bridgeSuffix;

  it("installer embeds the JSON-stringified helpers source with the globalThis bridge appended (#533)", () => {
    const { installer } = bundleRoundtripCache({ helpersSource, version });
    expect(installer).toContain(
      `var __CANICODE_HELPERS_SRC__ = ${JSON.stringify(bridgedHelpersSource)};`,
    );
  });

  it("installer evals the stringified helpers source so the global is defined without duplicating the IIFE verbatim (#424 budget)", () => {
    const { installer } = bundleRoundtripCache({ helpersSource, version });
    expect(installer).toContain("(0, eval)(__CANICODE_HELPERS_SRC__)");
    // Only the JSON.stringify'd copy of the bridged source should ship — the
    // raw (unescaped) IIFE must not also be inlined, or the install batch
    // doubles in size and blows the ~50KB use_figma soft budget the PR is
    // defending.
    const stringified = JSON.stringify(bridgedHelpersSource);
    const withoutStringifiedCopy = installer.replace(stringified, "");
    expect(withoutStringifiedCopy).not.toContain(helpersSource);
  });

  it("installer bridges CanICodeRoundtrip onto globalThis inside the eval'd source so Figma runtimes that don't honour indirect-eval var hoisting still see the global (#533)", () => {
    const { installer } = bundleRoundtripCache({ helpersSource, version });
    // The bridge has to live INSIDE the helpers source string (i.e. inside
    // the eval body). If it instead sat after the (0, eval)(...) call in the
    // installer template it would reference an out-of-scope identifier when
    // the runtime keeps the var local to the eval.
    expect(installer).toContain(
      "globalThis.CanICodeRoundtrip = CanICodeRoundtrip;",
    );
    // It should appear exactly once — inside the __CANICODE_HELPERS_SRC__
    // string literal. Removing the literal must leave no bare copy.
    const literal = `var __CANICODE_HELPERS_SRC__ = ${JSON.stringify(bridgedHelpersSource)};`;
    expect(installer).toContain(literal);
    const withoutLiteral = installer.replace(literal, "");
    expect(withoutLiteral).not.toContain(
      "globalThis.CanICodeRoundtrip = CanICodeRoundtrip",
    );
  });

  it("bootstrap evals the cached source which (since #533) includes the same globalThis bridge — the bridge is part of the cached helpers payload, not duplicated in the bootstrap template", () => {
    const { bootstrap } = bundleRoundtripCache({ helpersSource, version });
    // Bootstrap reads `src` from setSharedPluginData and evals it — that src
    // is the bridged helpers source the installer wrote, so the bridge runs
    // automatically. Bootstrap itself must not also emit a bare bridge line
    // (it would reference an out-of-scope identifier in the bootstrap IIFE).
    expect(bootstrap).not.toContain(
      "globalThis.CanICodeRoundtrip = CanICodeRoundtrip",
    );
  });

  it("installer UTF-8 size stays within helpers + modest wrapper overhead (regression for #424 / PR-472)", () => {
    const largeAscii = "x".repeat(32_000);
    const { installer } = bundleRoundtripCache({
      helpersSource: largeAscii,
      version: "0.0.0",
    });
    const bytes = Buffer.byteLength(installer, "utf8");
    expect(bytes).toBeLessThanOrEqual(
      Math.ceil(largeAscii.length * 1.12) + 2_000,
    );
    // Catches accidental double-embedding (~2× helpers) that would push the
    // install batch far past the ~50KB use_figma soft budget.
    expect(bytes).toBeLessThan(largeAscii.length * 1.9);
  });

  it("installer does not balloon toward 2× when helpers has many newlines (#424)", () => {
    const multiline = "const x = 1;\n".repeat(3_000);
    const { installer } = bundleRoundtripCache({
      helpersSource: multiline,
      version: "0.0.0",
    });
    const bytes = Buffer.byteLength(installer, "utf8");
    expect(bytes).toBeLessThan(multiline.length * 2.1);
  });

  it("installer writes both setSharedPluginData keys using the shared constants", () => {
    const { installer } = bundleRoundtripCache({ helpersSource, version });
    expect(installer).toContain(
      `figma.root.setSharedPluginData(${JSON.stringify(
        CANICODE_PLUGIN_DATA_NAMESPACE,
      )}, ${JSON.stringify(HELPERS_SRC_KEY)}, __CANICODE_HELPERS_SRC__);`,
    );
    expect(installer).toContain(
      `figma.root.setSharedPluginData(${JSON.stringify(
        CANICODE_PLUGIN_DATA_NAMESPACE,
      )}, ${JSON.stringify(HELPERS_VERSION_KEY)}, __CANICODE_HELPERS_VERSION__);`,
    );
  });

  it("installer stamps the version literal", () => {
    const { installer } = bundleRoundtripCache({ helpersSource, version });
    expect(installer).toContain(
      `var __CANICODE_HELPERS_VERSION__ = ${JSON.stringify(version)};`,
    );
  });

  it("bootstrap reads the cache using the shared constants", () => {
    const { bootstrap } = bundleRoundtripCache({ helpersSource, version });
    expect(bootstrap).toContain(
      `figma.root.getSharedPluginData(${JSON.stringify(
        CANICODE_PLUGIN_DATA_NAMESPACE,
      )}, ${JSON.stringify(HELPERS_SRC_KEY)})`,
    );
    expect(bootstrap).toContain(
      `figma.root.getSharedPluginData(${JSON.stringify(
        CANICODE_PLUGIN_DATA_NAMESPACE,
      )}, ${JSON.stringify(HELPERS_VERSION_KEY)})`,
    );
  });

  it("bootstrap bakes the expected version and version-checks", () => {
    const { bootstrap } = bundleRoundtripCache({ helpersSource, version });
    expect(bootstrap).toContain(`var expected = ${JSON.stringify(version)};`);
    expect(bootstrap).toContain("actual !== expected");
  });

  it("bootstrap evals the cached source on version match", () => {
    const { bootstrap } = bundleRoundtripCache({ helpersSource, version });
    expect(bootstrap).toContain("(0, eval)(src)");
  });

  it("bootstrap surfaces a structured cache-missing marker", () => {
    const { bootstrap } = bundleRoundtripCache({ helpersSource, version });
    expect(bootstrap).toContain(
      'canicodeBootstrapResult: "cache-missing"',
    );
    expect(bootstrap).toContain("__canicodeBootstrapResult");
    expect(bootstrap).toContain(
      'throw new ReferenceError("canicode-bootstrap:cache-missing',
    );
  });

  it("installer surfaces a structured __canicodeInstallResult marker on read-only files", () => {
    const { installer } = bundleRoundtripCache({ helpersSource, version });
    expect(installer).toContain("globalThis.__canicodeInstallResult");
    expect(installer).toContain("cachePersisted: true");
    expect(installer).toContain("cachePersisted: false");
    expect(installer).toMatch(/try\s*\{[\s\S]*setSharedPluginData[\s\S]*\}\s*catch/);
  });

  it("bootstrap surfaces a structured version-mismatch marker", () => {
    const { bootstrap } = bundleRoundtripCache({ helpersSource, version });
    expect(bootstrap).toContain(
      'canicodeBootstrapResult: "version-mismatch"',
    );
    expect(bootstrap).toContain(
      'throw new ReferenceError("canicode-bootstrap:version-mismatch',
    );
  });
});
