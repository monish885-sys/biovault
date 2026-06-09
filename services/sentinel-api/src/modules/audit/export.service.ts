import { Types } from "mongoose";
import { ValidationError } from "@biovault/common";
import { AuditEventModel } from "../../db/schemas/audit-event.js";
import { verifyAuditChain } from "./chain.js";

export type AuditEventSummary = {
  id: string;
  action: string;
  userId?: string;
  clientId?: string;
  ipAddress?: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  prevHash?: string;
  createdAt: string;
};

export type AuditEventListResponse = {
  events: AuditEventSummary[];
  total: number;
};

export type AuditExportResponse = {
  exportedAt: string;
  chainValid: boolean;
  eventCount: number;
  events: AuditEventSummary[];
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const MAX_EXPORT = 10_000;

function clampLimit(raw: number | undefined, max: number): number {
  if (raw === undefined || Number.isNaN(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), max);
}

function clampOffset(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return 0;
  return Math.max(Math.trunc(raw), 0);
}

function parseDateBound(raw: string | undefined, label: string): Date | undefined {
  if (!raw?.trim()) return undefined;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`${label} must be a valid ISO date`);
  }
  return d;
}

function toSummary(doc: Record<string, unknown>): AuditEventSummary {
  return {
    id: String(doc._id),
    action: String(doc.action),
    userId: doc.userId ? String(doc.userId) : undefined,
    clientId: doc.clientId ? String(doc.clientId) : undefined,
    ipAddress: typeof doc.ipAddress === "string" ? doc.ipAddress : undefined,
    payload: (doc.payload ?? {}) as Record<string, unknown>,
    payloadHash: String(doc.payloadHash),
    prevHash: doc.prevHash ? String(doc.prevHash) : undefined,
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date()).toISOString(),
  };
}

function buildFilter(params: {
  clientId?: string;
  action?: string;
  from?: string;
  to?: string;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (params.clientId) {
    if (!Types.ObjectId.isValid(params.clientId)) {
      throw new ValidationError("clientId must be a valid identifier");
    }
    filter.clientId = new Types.ObjectId(params.clientId);
  }

  const action = params.action?.trim();
  if (action) {
    filter.action = action;
  }

  const from = parseDateBound(params.from, "from");
  const to = parseDateBound(params.to, "to");
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = from;
    if (to) createdAt.$lte = to;
    filter.createdAt = createdAt;
  }

  return filter;
}

export type ListAuditEventsParams = {
  clientId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export async function listAuditEvents(
  params: ListAuditEventsParams = {},
): Promise<AuditEventListResponse> {
  const filter = buildFilter(params);
  const limit = clampLimit(params.limit, MAX_LIMIT);
  const offset = clampOffset(params.offset);

  const [docs, total] = await Promise.all([
    AuditEventModel.find(filter)
      .sort({ createdAt: 1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    AuditEventModel.countDocuments(filter),
  ]);

  return {
    events: docs.map((d) => toSummary(d as Record<string, unknown>)),
    total,
  };
}

export type ExportAuditTrailParams = {
  clientId?: string;
  from?: string;
  to?: string;
};

export async function exportAuditTrail(
  params: ExportAuditTrailParams = {},
): Promise<AuditExportResponse> {
  const filter = buildFilter(params);

  const docs = await AuditEventModel.find(filter)
    .sort({ createdAt: 1 })
    .limit(MAX_EXPORT)
    .lean();

  const events = docs.map((d) => toSummary(d as Record<string, unknown>));
  const chainValid = verifyAuditChain(
    events.map((e) => ({
      payload: e.payload,
      payloadHash: e.payloadHash,
      prevHash: e.prevHash,
    })),
  );

  return {
    exportedAt: new Date().toISOString(),
    chainValid,
    eventCount: events.length,
    events,
  };
}
