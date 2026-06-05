import { describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const auditMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../../db/schemas/audit-event.js", () => ({
  AuditEventModel: {
    findOne: auditMocks.findOne,
    create: auditMocks.create,
  },
}));

import { recordAuditEvent } from "./audit.service.js";

describe("recordAuditEvent", () => {
  it("chains payload hashes", async () => {
    const sort = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ payloadHash: "prev-abc" }),
      }),
    });
    auditMocks.findOne.mockReturnValue({ sort });
    auditMocks.create.mockResolvedValue({});

    await recordAuditEvent({
      action: "auth.login",
      userId: new Types.ObjectId(),
      payload: { email: "a@test.com" },
    });

    expect(auditMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login",
        prevHash: "prev-abc",
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });
});
