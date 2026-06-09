import { describe, expect, it } from "vitest";
import { computeTapeHealthScore } from "./health.js";

describe("computeTapeHealthScore", () => {
  const now = new Date();

  it("returns green for low usage tapes", () => {
    expect(
      computeTapeHealthScore({
        writeCycles: 10,
        fillPercent: 20,
        purchasedAt: now,
      }),
    ).toBe("green");
  });

  it("returns amber when write cycles exceed threshold", () => {
    expect(
      computeTapeHealthScore({
        writeCycles: 120,
        fillPercent: 20,
        purchasedAt: now,
      }),
    ).toBe("amber");
  });

  it("returns red when write cycles are very high", () => {
    expect(
      computeTapeHealthScore({
        writeCycles: 250,
        fillPercent: 20,
        purchasedAt: now,
      }),
    ).toBe("red");
  });

  it("returns amber when fill percent is high", () => {
    expect(
      computeTapeHealthScore({
        writeCycles: 10,
        fillPercent: 95,
        purchasedAt: now,
      }),
    ).toBe("amber");
  });
});
