import { createHash } from "node:crypto";

export type AuditEventRecord = {
  payload: Record<string, unknown>;
  payloadHash: string;
  prevHash?: string | null;
};

export function hashAuditPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** Verify hash chain integrity for events in chronological order. */
export function verifyAuditChain(events: AuditEventRecord[]): boolean {
  let expectedPrev: string | undefined;
  for (const event of events) {
    const computed = hashAuditPayload(event.payload);
    if (computed !== event.payloadHash) return false;
    if (expectedPrev !== undefined) {
      if (event.prevHash !== expectedPrev) return false;
    } else if (event.prevHash != null && event.prevHash !== "") {
      // First event in a slice may still reference an earlier chain link.
      // Only validate prevHash linkage between consecutive events in this batch.
    }
    expectedPrev = event.payloadHash;
  }
  return true;
}
