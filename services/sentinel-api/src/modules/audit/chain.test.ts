import { describe, expect, it } from "vitest";
import { hashAuditPayload, verifyAuditChain } from "./chain.js";

describe("verifyAuditChain", () => {
  it("accepts a valid hash chain", () => {
    const p1 = { action: "auth.login" };
    const h1 = hashAuditPayload(p1);
    const p2 = { action: "ingest.job_created", jobId: "abc" };
    const h2 = hashAuditPayload(p2);

    expect(
      verifyAuditChain([
        { payload: p1, payloadHash: h1 },
        { payload: p2, payloadHash: h2, prevHash: h1 },
      ]),
    ).toBe(true);
  });

  it("rejects tampered payload hash", () => {
    const p1 = { action: "auth.login" };
    expect(
      verifyAuditChain([{ payload: p1, payloadHash: "deadbeef".repeat(8) }]),
    ).toBe(false);
  });

  it("rejects broken prevHash linkage", () => {
    const p1 = { action: "a" };
    const h1 = hashAuditPayload(p1);
    const p2 = { action: "b" };
    const h2 = hashAuditPayload(p2);

    expect(
      verifyAuditChain([
        { payload: p1, payloadHash: h1 },
        { payload: p2, payloadHash: h2, prevHash: "wrong" },
      ]),
    ).toBe(false);
  });
});
