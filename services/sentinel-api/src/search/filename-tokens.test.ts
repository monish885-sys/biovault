import { describe, expect, it, vi } from "vitest";
import { buildFilenameSearchTokens } from "./filename-tokens.js";

describe("buildFilenameSearchTokens", () => {
  it("returns HMAC-SHA256 hex tokens scoped to clientId", () => {
    vi.stubEnv("SEARCH_TOKEN_SECRET", "test-secret");
    const tokens = buildFilenameSearchTokens("scan-001.dcm", "507f1f77bcf86cd799439011");
    expect(tokens).toHaveLength(3);
    expect(tokens.every((t) => /^[a-f0-9]{64}$/.test(t))).toBe(true);
    vi.unstubAllEnvs();
  });

  it("produces different tokens for different clients", () => {
    vi.stubEnv("SEARCH_TOKEN_SECRET", "test-secret");
    const a = buildFilenameSearchTokens("report.pdf", "client-a");
    const b = buildFilenameSearchTokens("report.pdf", "client-b");
    expect(a).not.toEqual(b);
    vi.unstubAllEnvs();
  });
});
