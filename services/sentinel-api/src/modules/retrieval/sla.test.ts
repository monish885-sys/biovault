import { describe, expect, it } from "vitest";
import { RETRIEVAL_SLA_MS } from "./retrieval.constants.js";
import { computeDueAt, computeSlaRemainingSeconds } from "./sla.js";

describe("retrieval SLA", () => {
  it("computes dueAt as createdAt + 15 minutes", () => {
    const createdAt = new Date("2026-06-08T10:00:00.000Z");
    const dueAt = computeDueAt(createdAt);
    expect(dueAt.getTime() - createdAt.getTime()).toBe(RETRIEVAL_SLA_MS);
  });

  it("returns positive slaRemainingSeconds before deadline", () => {
    const dueAt = new Date("2026-06-08T10:15:00.000Z");
    const now = new Date("2026-06-08T10:10:00.000Z");
    expect(computeSlaRemainingSeconds(dueAt, now)).toBe(300);
  });

  it("returns negative slaRemainingSeconds when overdue", () => {
    const dueAt = new Date("2026-06-08T10:00:00.000Z");
    const now = new Date("2026-06-08T10:05:00.000Z");
    expect(computeSlaRemainingSeconds(dueAt, now)).toBe(-300);
  });
});
