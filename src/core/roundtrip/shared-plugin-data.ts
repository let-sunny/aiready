/**
 * Centralises the `figma.root.setSharedPluginData` namespace + key strings used
 * by the canicode-roundtrip helpers cache (#424). The installer trailer, the
 * bootstrap loader template, and any future TypeScript consumer (e.g. a probe
 * helper that reads the cache version) import from this single source of truth
 * so drifting any of the three literals cannot silently break the cache.
 *
 * The namespace is exactly 8 characters — the Plugin API historically caps
 * `setSharedPluginData` namespaces at 8 chars. Any future edit must keep this
 * constraint in mind.
 */
export const CANICODE_PLUGIN_DATA_NAMESPACE = "canicode";
export const HELPERS_SRC_KEY = "helpersSrc";
export const HELPERS_VERSION_KEY = "helpersVersion";
