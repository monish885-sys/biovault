import { Types } from "mongoose";
import { ValidationError } from "@biovault/common";
import { ClientModel } from "../../db/schemas/client.js";
import { FileModel } from "../../db/schemas/file.js";
import { FileLocationModel } from "../../db/schemas/file-location.js";
import { RetrievalJobModel } from "../../db/schemas/retrieval-job.js";
import { TapeModel } from "../../db/schemas/tape.js";
import { UserModel } from "../../db/schemas/user.js";
import { computeSlaRemainingSeconds } from "../retrieval/sla.js";

export type AdminTapeLocation = {
  tapeBarcode: string;
  rack: string;
  slot: string;
};

export type AdminRetrievalJobSummary = {
  id: string;
  clientId: string;
  clientName: string;
  fileId: string;
  filename: string;
  fileType: string;
  category: string;
  status: string;
  dueAt: string;
  createdAt: string;
  slaRemainingSeconds: number;
  slaOverdue: boolean;
  requestedBy: string;
  assignedTo?: string;
  tape?: AdminTapeLocation;
};

export type AdminJobListResponse = {
  jobs: AdminRetrievalJobSummary[];
  total: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const RETRIEVAL_STATUSES = [
  "pending",
  "assigned",
  "in_progress",
  "ready",
  "delivered",
  "expired",
  "failed",
] as const;

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), MAX_LIMIT);
}

function clampOffset(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return 0;
  return Math.max(Math.trunc(raw), 0);
}

export type ListAdminJobsParams = {
  status?: string;
  overdue?: boolean;
  limit?: number;
  offset?: number;
};

export async function listAdminJobs(
  params: ListAdminJobsParams = {},
): Promise<AdminJobListResponse> {
  const filter: Record<string, unknown> = {};

  const status = params.status?.trim();
  if (status) {
    if (!(RETRIEVAL_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationError(`status must be one of: ${RETRIEVAL_STATUSES.join(", ")}`);
    }
    filter.status = status;
  }

  if (params.overdue) {
    filter.dueAt = { $lt: new Date() };
    if (!status) {
      filter.status = { $in: ["pending", "assigned", "in_progress", "ready"] };
    }
  }

  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);

  const [jobs, total] = await Promise.all([
    RetrievalJobModel.find(filter)
      .sort({ dueAt: 1, createdAt: 1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    RetrievalJobModel.countDocuments(filter),
  ]);

  if (jobs.length === 0) {
    return { jobs: [], total };
  }

  const fileIds = jobs.map((j) => j.fileId);
  const clientIds = [...new Set(jobs.map((j) => String(j.clientId)))];
  const userIds = [
    ...new Set(
      jobs.flatMap((j) => [String(j.requestedBy), j.assignedTo ? String(j.assignedTo) : null]),
    ),
  ].filter((id): id is string => id !== null);

  const [files, clients, users, locations] = await Promise.all([
    FileModel.find({ _id: { $in: fileIds } })
      .select("filename fileType category")
      .lean(),
    ClientModel.find({ _id: { $in: clientIds.map((id) => new Types.ObjectId(id)) } })
      .select("name")
      .lean(),
    UserModel.find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
      .select("email")
      .lean(),
    FileLocationModel.find({ fileId: { $in: fileIds } }).lean(),
  ]);

  const fileById = new Map(files.map((f) => [String(f._id), f]));
  const clientById = new Map(clients.map((c) => [String(c._id), c]));
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const locationByFileId = new Map(locations.map((l) => [String(l.fileId), l]));

  const barcodes = [...new Set(locations.map((l) => l.tapeBarcode))];
  const tapes =
    barcodes.length > 0
      ? await TapeModel.find({ barcode: { $in: barcodes } })
          .select("barcode rack slot")
          .lean()
      : [];
  const tapeByBarcode = new Map(tapes.map((t) => [t.barcode, t]));

  const now = new Date();
  const summaries: AdminRetrievalJobSummary[] = [];

  for (const job of jobs) {
    const file = fileById.get(String(job.fileId));
    const client = clientById.get(String(job.clientId));
    if (!file || !client) continue;

    const requester = userById.get(String(job.requestedBy));
    const assignee = job.assignedTo ? userById.get(String(job.assignedTo)) : undefined;
    const location = locationByFileId.get(String(job.fileId));
    const tape = location ? tapeByBarcode.get(location.tapeBarcode) : undefined;

    const slaRemainingSeconds = computeSlaRemainingSeconds(job.dueAt, now);

    const summary: AdminRetrievalJobSummary = {
      id: String(job._id),
      clientId: String(job.clientId),
      clientName: client.name,
      fileId: String(job.fileId),
      filename: file.filename,
      fileType: file.fileType,
      category: file.category,
      status: job.status,
      dueAt: job.dueAt.toISOString(),
      createdAt: (job.createdAt ?? new Date()).toISOString(),
      slaRemainingSeconds,
      slaOverdue: slaRemainingSeconds < 0,
      requestedBy: requester?.email ?? String(job.requestedBy),
    };

    if (assignee) {
      summary.assignedTo = assignee.email;
    }

    if (tape) {
      summary.tape = {
        tapeBarcode: tape.barcode,
        rack: tape.rack,
        slot: tape.slot,
      };
    }

    summaries.push(summary);
  }

  return { jobs: summaries, total };
}
