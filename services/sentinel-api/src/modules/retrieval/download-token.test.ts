import { afterEach, describe, expect, it, vi } from "vitest";

describe("download token", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a signed download token", async () => {
    vi.stubEnv("DOWNLOAD_TOKEN_SECRET", "test-download-secret");
    const { signDownloadToken, verifyDownloadToken } = await import("./download-token.js");

    const expiresAt = new Date(Date.now() + 60_000);
    const token = signDownloadToken("507f1f77bcf86cd799439301", expiresAt);
    const payload = verifyDownloadToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.jobId).toBe("507f1f77bcf86cd799439301");
    expect(payload?.exp).toBe(Math.floor(expiresAt.getTime() / 1000));
  });

  it("rejects expired tokens", async () => {
    vi.stubEnv("DOWNLOAD_TOKEN_SECRET", "test-download-secret");
    const { signDownloadToken, verifyDownloadToken } = await import("./download-token.js");

    const expiresAt = new Date(Date.now() - 1000);
    const token = signDownloadToken("507f1f77bcf86cd799439301", expiresAt);
    expect(verifyDownloadToken(token)).toBeNull();
  });
});
