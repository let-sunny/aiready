import {
  isCanicodeAnnotation,
  removeCanicodeAnnotations,
} from "./remove-canicode-annotations.js";

const CATEGORIES = {
  gotcha: "cat-gotcha",
  flag: "cat-flag",
  fallback: "cat-fallback",
};

const CATEGORIES_WITH_LEGACY = {
  ...CATEGORIES,
  legacyAutoFix: "cat-legacy-auto-fix",
};

describe("isCanicodeAnnotation", () => {
  it("matches annotations whose categoryId is in the canicode set", () => {
    expect(
      isCanicodeAnnotation({ categoryId: "cat-gotcha" }, CATEGORIES),
    ).toBe(true);
    expect(isCanicodeAnnotation({ categoryId: "cat-flag" }, CATEGORIES)).toBe(
      true,
    );
    expect(
      isCanicodeAnnotation({ categoryId: "cat-fallback" }, CATEGORIES),
    ).toBe(true);
  });

  it("matches the legacy auto-fix category only when the file carries it", () => {
    const legacy = { categoryId: "cat-legacy-auto-fix" };

    expect(isCanicodeAnnotation(legacy, CATEGORIES)).toBe(false);
    expect(isCanicodeAnnotation(legacy, CATEGORIES_WITH_LEGACY)).toBe(true);
  });

  it("matches annotations whose body still starts with the legacy [canicode] prefix", () => {
    expect(
      isCanicodeAnnotation(
        { labelMarkdown: "**[canicode] missing-size-constraint** — ..." },
        CATEGORIES,
      ),
    ).toBe(true);
  });

  it("matches the legacy prefix even when categoryId is absent (pre-#353 entries)", () => {
    expect(
      isCanicodeAnnotation(
        { labelMarkdown: "**[canicode] non-semantic-name**" },
        CATEGORIES,
      ),
    ).toBe(true);
  });

  it("preserves user-authored annotations with no canicode signals", () => {
    expect(
      isCanicodeAnnotation(
        { categoryId: "cat-user", labelMarkdown: "TODO: revisit copy" },
        CATEGORIES,
      ),
    ).toBe(false);
  });

  it("preserves third-party annotations whose body merely mentions canicode", () => {
    expect(
      isCanicodeAnnotation(
        {
          categoryId: "cat-other-plugin",
          labelMarkdown: "Note: canicode flagged this earlier — keep for ref",
        },
        CATEGORIES,
      ),
    ).toBe(false);
  });

  it("ignores empty / missing categories on the input map", () => {
    expect(isCanicodeAnnotation({ categoryId: "" }, CATEGORIES)).toBe(false);
    expect(isCanicodeAnnotation({}, CATEGORIES)).toBe(false);
  });
});

describe("removeCanicodeAnnotations", () => {
  it("removes every canicode-authored entry and preserves the rest", () => {
    const input = [
      { categoryId: "cat-gotcha", labelMarkdown: "Gotcha note" },
      { categoryId: "cat-user", labelMarkdown: "Designer note" },
      { categoryId: "cat-flag", labelMarkdown: "Flag note" },
      { labelMarkdown: "**[canicode] non-semantic-name** — legacy entry" },
      { categoryId: "cat-other-plugin", labelMarkdown: "Plugin note" },
    ];

    const result = removeCanicodeAnnotations(input, CATEGORIES);

    expect(result).toEqual([
      { categoryId: "cat-user", labelMarkdown: "Designer note" },
      { categoryId: "cat-other-plugin", labelMarkdown: "Plugin note" },
    ]);
  });

  it("returns an empty array when every annotation was canicode-authored", () => {
    const input = [
      { categoryId: "cat-gotcha" },
      { categoryId: "cat-flag" },
      { categoryId: "cat-fallback" },
      { labelMarkdown: "**[canicode] missing-component**" },
    ];

    expect(removeCanicodeAnnotations(input, CATEGORIES)).toEqual([]);
  });

  it("returns an empty array unchanged for empty input", () => {
    expect(removeCanicodeAnnotations([], CATEGORIES)).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { categoryId: "cat-gotcha" },
      { categoryId: "cat-user" },
    ];
    const snapshot = [...input];

    removeCanicodeAnnotations(input, CATEGORIES);

    expect(input).toEqual(snapshot);
  });

  it("sweeps legacy auto-fix entries when categories carries the id (pre-#355 roundtrip files)", () => {
    const input = [
      { categoryId: "cat-legacy-auto-fix", labelMarkdown: "old auto-fix" },
      { categoryId: "cat-user", labelMarkdown: "designer note" },
    ];

    expect(removeCanicodeAnnotations(input, CATEGORIES_WITH_LEGACY)).toEqual([
      { categoryId: "cat-user", labelMarkdown: "designer note" },
    ]);
  });
});
