import { computeRoundtripTally } from "./compute-roundtrip-tally.js";

describe("computeRoundtripTally", () => {
  it("passes the four Step-4 counts through to X/Y/Z/W and sums them as N", () => {
    const tally = computeRoundtripTally({
      stepFourReport: {
        resolved: 3,
        annotated: 5,
        definitionWritten: 2,
        skipped: 1,
      },
      reanalyzeResponse: { issueCount: 0, acknowledgedCount: 0 },
    });

    expect(tally.X).toBe(3);
    expect(tally.Y).toBe(5);
    expect(tally.Z).toBe(2);
    expect(tally.W).toBe(1);
    expect(tally.N).toBe(3 + 5 + 2 + 1);
  });

  it("derives V / V_ack / V_open from the re-analyze response", () => {
    const tally = computeRoundtripTally({
      stepFourReport: {
        resolved: 0,
        annotated: 4,
        definitionWritten: 0,
        skipped: 0,
      },
      reanalyzeResponse: { issueCount: 7, acknowledgedCount: 3 },
    });

    expect(tally.V).toBe(7);
    expect(tally.V_ack).toBe(3);
    expect(tally.V_open).toBe(4);
  });

  it("returns all-zero counts when nothing happened (empty roundtrip)", () => {
    const tally = computeRoundtripTally({
      stepFourReport: {
        resolved: 0,
        annotated: 0,
        definitionWritten: 0,
        skipped: 0,
      },
      reanalyzeResponse: { issueCount: 0, acknowledgedCount: 0 },
    });

    expect(tally).toEqual({
      X: 0,
      Y: 0,
      Z: 0,
      W: 0,
      N: 0,
      V: 0,
      V_ack: 0,
      V_open: 0,
    });
  });

  it("returns V_open === V when the re-analyze surfaces no acknowledgments", () => {
    const tally = computeRoundtripTally({
      stepFourReport: {
        resolved: 1,
        annotated: 0,
        definitionWritten: 0,
        skipped: 0,
      },
      reanalyzeResponse: { issueCount: 5, acknowledgedCount: 0 },
    });

    expect(tally.V).toBe(5);
    expect(tally.V_ack).toBe(0);
    expect(tally.V_open).toBe(5);
  });

  it("returns V_open === 0 when every remaining issue is acknowledged", () => {
    const tally = computeRoundtripTally({
      stepFourReport: {
        resolved: 0,
        annotated: 4,
        definitionWritten: 0,
        skipped: 0,
      },
      reanalyzeResponse: { issueCount: 4, acknowledgedCount: 4 },
    });

    expect(tally.V).toBe(4);
    expect(tally.V_ack).toBe(4);
    expect(tally.V_open).toBe(0);
  });

  it("throws when acknowledgedCount exceeds issueCount (impossible state)", () => {
    expect(() =>
      computeRoundtripTally({
        stepFourReport: {
          resolved: 0,
          annotated: 0,
          definitionWritten: 0,
          skipped: 0,
        },
        reanalyzeResponse: { issueCount: 3, acknowledgedCount: 5 },
      }),
    ).toThrow(/cannot exceed issueCount/);
  });
});
