import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("session", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "test-secret-for-session-signing");
    vi.stubEnv("SESSION_TTL_SECONDS", "3600");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("round-trips a signed session", async () => {
    const { signSession, verifySession } = await import("./session.js");
    const token = signSession({
      sub: "507f1f77bcf86cd799439011",
      role: "client_admin",
      clientId: "507f1f77bcf86cd799439012",
    });
    const payload = verifySession(token);
    expect(payload?.sub).toBe("507f1f77bcf86cd799439011");
    expect(payload?.role).toBe("client_admin");
    expect(payload?.clientId).toBe("507f1f77bcf86cd799439012");
  });

  it("rejects tampered tokens", async () => {
    const { signSession, verifySession } = await import("./session.js");
    const token = signSession({ sub: "a", role: "ops_admin" });
    const tampered = `${token}x`;
    expect(verifySession(tampered)).toBeNull();
  });

  it("rejects expired sessions", async () => {
    const { createHmac } = await import("node:crypto");
    const { verifySession } = await import("./session.js");
    const body = Buffer.from(
      JSON.stringify({ sub: "a", role: "technician", exp: 1 }),
    ).toString("base64url");
    const sig = createHmac("sha256", "test-secret-for-session-signing")
      .update(body)
      .digest("base64url");
    expect(verifySession(`${body}.${sig}`)).toBeNull();
  });
});
