import { bundleRoundtripCache } from "./bundle-roundtrip-cache.js";
import {
  CANICODE_PLUGIN_DATA_NAMESPACE,
  HELPERS_SRC_KEY,
  HELPERS_VERSION_KEY,
} from "../src/core/roundtrip/shared-plugin-data.js";

describe("bundleRoundtripCache", () => {
  const helpersSource = "var CanICodeRoundtrip = { version: 'fake' };";
  const version = "9.9.9";

  it("installer embeds the JSON-stringified helpers source", () => {
    const { installer } = bundleRoundtripCache({ helpersSource, version });
    expect(installer).toContain(
      `var __CANICODE_HELPERS_SRC__ = ${JSON.stringify(helpersSource)};`,
    );
  });

  it("installer inlines the helpers source so the global is defined for the install batch", () => {
    const { installer } = bundleRoundtripCache({ helpersSource, version });
    expect(installer).toContain(helpersSource);
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
