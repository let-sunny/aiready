import {
  gaugeColor,
  scoreClass,
  escapeHtml,
  severityDotClass,
  severityScoreClass,
  severityDot,
  severityBadge,
  scoreBadgeStyle,
  renderGaugeSvg,
} from "./ui-helpers.js";

// ---- gaugeColor ----

describe("gaugeColor", () => {
  it("returns green for pct >= 75", () => {
    expect(gaugeColor(75)).toBe("#22c55e");
    expect(gaugeColor(100)).toBe("#22c55e");
  });

  it("returns amber for 50 <= pct < 75", () => {
    expect(gaugeColor(50)).toBe("#f59e0b");
    expect(gaugeColor(74)).toBe("#f59e0b");
  });

  it("returns red for pct < 50", () => {
    expect(gaugeColor(0)).toBe("#ef4444");
    expect(gaugeColor(49)).toBe("#ef4444");
  });
});

// ---- scoreClass ----

describe("scoreClass", () => {
  it("returns green/amber/red based on threshold", () => {
    expect(scoreClass(75)).toBe("green");
    expect(scoreClass(50)).toBe("amber");
    expect(scoreClass(49)).toBe("red");
  });
});

// ---- escapeHtml ----

describe("escapeHtml", () => {
  it("escapes &, <, >, quotes", () => {
    expect(escapeHtml('a & b < c > d "e" \'f\'')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot; &#039;f&#039;"
    );
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

// ---- severityDotClass (plugin legacy) ----

describe("severityDotClass", () => {
  it("maps each severity to a dot class", () => {
    expect(severityDotClass("blocking")).toBe("dot-blocking");
    expect(severityDotClass("risk")).toBe("dot-risk");
    expect(severityDotClass("missing-info")).toBe("dot-missing");
    expect(severityDotClass("suggestion")).toBe("dot-suggestion");
  });

  it("returns dot-missing for unknown", () => {
    expect(severityDotClass("unknown")).toBe("dot-missing");
  });
});

// ---- severityScoreClass (plugin legacy) ----

describe("severityScoreClass", () => {
  it("maps each severity to a score class", () => {
    expect(severityScoreClass("blocking")).toBe("score-blocking");
    expect(severityScoreClass("risk")).toBe("score-risk");
    expect(severityScoreClass("missing-info")).toBe("score-missing");
    expect(severityScoreClass("suggestion")).toBe("score-suggestion");
  });

  it("returns score-missing for unknown", () => {
    expect(severityScoreClass("unknown")).toBe("score-missing");
  });
});

// ---- severityDot (report semantic) ----

describe("severityDot", () => {
  it("maps each severity to a semantic class", () => {
    expect(severityDot("blocking")).toBe("sev-blocking");
    expect(severityDot("risk")).toBe("sev-risk");
    expect(severityDot("missing-info")).toBe("sev-missing");
    expect(severityDot("suggestion")).toBe("sev-suggestion");
  });
});

// ---- severityBadge ----

describe("severityBadge", () => {
  it("maps each severity to a semantic class", () => {
    expect(severityBadge("blocking")).toBe("sev-blocking");
    expect(severityBadge("risk")).toBe("sev-risk");
    expect(severityBadge("missing-info")).toBe("sev-missing");
    expect(severityBadge("suggestion")).toBe("sev-suggestion");
  });
});

// ---- scoreBadgeStyle ----

describe("scoreBadgeStyle", () => {
  it("returns score-green for pct >= 75", () => {
    expect(scoreBadgeStyle(75)).toBe("score-green");
    expect(scoreBadgeStyle(100)).toBe("score-green");
  });

  it("returns score-amber for 50 <= pct < 75", () => {
    expect(scoreBadgeStyle(50)).toBe("score-amber");
    expect(scoreBadgeStyle(74)).toBe("score-amber");
  });

  it("returns score-red for pct < 50", () => {
    expect(scoreBadgeStyle(0)).toBe("score-red");
    expect(scoreBadgeStyle(49)).toBe("score-red");
  });
});

// ---- renderGaugeSvg ----

describe("renderGaugeSvg", () => {
  it("renders an SVG with gauge-svg class", () => {
    const svg = renderGaugeSvg(80, 200, 10);
    expect(svg).toContain('class="gauge-svg"');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('class="gauge-fill"');
  });

  it("does not contain Tailwind classes", () => {
    const svg = renderGaugeSvg(80, 200, 10, "A");
    expect(svg).not.toContain("stroke-border");
    expect(svg).not.toContain("font-sans");
    expect(svg).not.toContain('"block"');
  });

  it("shows grade text when grade is provided", () => {
    const svg = renderGaugeSvg(80, 200, 10, "A+");
    expect(svg).toContain("font-size=\"48\"");
    expect(svg).toContain("A+");
  });

  it("shows percentage text when no grade", () => {
    const svg = renderGaugeSvg(42, 100, 7);
    expect(svg).toContain("font-size=\"28\"");
    expect(svg).toContain(">42<");
  });

  it("uses correct stroke color based on percentage", () => {
    expect(renderGaugeSvg(80, 100, 7)).toContain('stroke="#22c55e"');
    expect(renderGaugeSvg(60, 100, 7)).toContain('stroke="#f59e0b"');
    expect(renderGaugeSvg(30, 100, 7)).toContain('stroke="#ef4444"');
  });

  it("escapes grade text", () => {
    const svg = renderGaugeSvg(80, 200, 10, "<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain("<script>");
  });
});
