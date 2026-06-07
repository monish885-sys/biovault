import { describe, expect, it, vi } from "vitest";
import { buildKeywordSearchTokens } from "./keyword-tokens.js";

describe("buildKeywordSearchTokens", () => {
  it("returns HMAC-SHA256 tokens for keyword values", () => {
    vi.stubEnv("SEARCH_TOKEN_SECRET", "test-secret");
    const tokens = buildKeywordSearchTokens(
      { department: "radiology", patientRef: "pt-001" },
      "507f1f77bcf86cd799439011",
    );
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((t) => /^[a-f0-9]{64}$/.test(t))).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns empty array when metadata is absent", () => {
    expect(buildKeywordSearchTokens(undefined, "client-a")).toEqual([]);
  });
});
