import { describe, expect, it } from "vitest";
import { bytesToTb, roundInr, roundTb, TIER_LIMITS } from "./tiers.js";

describe("billing tiers", () => {
  it("converts bytes to TB", () => {
    expect(roundTb(bytesToTb(1024 ** 4))).toBe(1);
  });

  it("defines tier limits", () => {
    expect(TIER_LIMITS.standard.retrievalsPerMonth).toBe(20);
    expect(TIER_LIMITS.enterprise.storageTb).toBe(20);
  });

  it("rounds INR", () => {
    expect(roundInr(450.6)).toBe(451);
  });
});
