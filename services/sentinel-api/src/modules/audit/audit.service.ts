import { createHash } from "node:crypto";
import type { Types } from "mongoose";
import { AuditEventModel } from "../../db/schemas/audit-event.js";

export type AuditParams = {
  action: string;
  userId?: Types.ObjectId;
  clientId?: Types.ObjectId;
  ipAddress?: string;
  payload?: Record<string, unknown>;
};

function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function recordAuditEvent(params: AuditParams): Promise<void> {
  const payload = params.payload ?? {};
  const payloadHash = hashPayload(payload);
  const last = await AuditEventModel.findOne()
    .sort({ createdAt: -1 })
    .select("payloadHash")
    .lean();
  await AuditEventModel.create({
    action: params.action,
    userId: params.userId,
    clientId: params.clientId,
    ipAddress: params.ipAddress,
    payload,
    payloadHash,
    prevHash: last?.payloadHash,
  });
}
