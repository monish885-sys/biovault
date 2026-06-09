import { describe, expect, it, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { hashAuditPayload } from "./chain.js";

const events = [
  {
    _id: new Types.ObjectId(),
    action: "auth.login",
    payload: { email: "a@test.com" },
    payloadHash: "",
    createdAt: new Date("2026-06-01T10:00:00Z"),
  },
  {
    _id: new Types.ObjectId(),
    action: "ingest.job_created",
    payload: { jobId: "j1" },
    payloadHash: "",
    prevHash: "",
    createdAt: new Date("2026-06-01T10:01:00Z"),
  },
];

events[0].payloadHash = hashAuditPayload(events[0].payload as Record<string, unknown>);
events[1].payloadHash = hashAuditPayload(events[1].payload as Record<string, unknown>);
events[1].prevHash = events[0].payloadHash;

vi.mock("../../db/schemas/audit-event.js", () => ({
  AuditEventModel: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        skip: vi.fn(() => ({
          limit: vi.fn(() => ({
            lean: vi.fn(async () => events),
          })),
        })),
        limit: vi.fn(() => ({
          lean: vi.fn(async () => events),
        })),
      })),
    })),
    countDocuments: vi.fn(async () => events.length),
  },
}));

import { exportAuditTrail, listAuditEvents } from "./export.service.js";

describe("exportAuditTrail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports events with valid chain", async () => {
    const result = await exportAuditTrail();
    expect(result.eventCount).toBe(2);
    expect(result.chainValid).toBe(true);
    expect(result.events[0].action).toBe("auth.login");
  });

  it("lists paginated audit events", async () => {
    const result = await listAuditEvents({ limit: 10 });
    expect(result.total).toBe(2);
    expect(result.events).toHaveLength(2);
  });
});
