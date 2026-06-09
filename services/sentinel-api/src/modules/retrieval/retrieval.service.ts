import { Types } from "mongoose";
import { NotFoundError, ValidationError } from "@biovault/common";
import { FileModel } from "../../db/schemas/file.js";
import { RetrievalJobModel } from "../../db/schemas/retrieval-job.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import { ACTIVE_RETRIEVAL_STATUSES } from "./retrieval.constants.js";
import { buildDownloadPath } from "./download-token.js";
import { enqueueUnassignedAlert } from "./retrieval.queue.js";
import { computeDueAt, computeSlaRemainingSeconds } from "./sla.js";

export type ClientRetrievalJobSummary = {
  id: string;
  fileId: string;
  filename: string;
  fileType: string;
  category: string;
  status: string;
  dueAt: string;
  createdAt: string;
  slaRemainingSeconds: number;
  slaOverdue: boolean;
  downloadUrl?: string;
  downloadExpiresAt?: string;
};

export type RetrievalJobListResponse = {
  jobs: ClientRetrievalJobSummary[];
  total: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function isValidObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value) && String(new Types.ObjectId(value)) === value;
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), MAX_LIMIT);
}

function clampOffset(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return 0;
  return Math.max(Math.trunc(raw), 0);
}

type JobLike = {
  _id: Types.ObjectId | { toString(): string };
  fileId: Types.ObjectId | { toString(): string };
  status: string;
  dueAt: Date;
  createdAt?: Date;
  downloadToken?: string;
  downloadExpiresAt?: Date;
};

function toClientSummary(
  job: JobLike,
  file: { filename: string; fileType: string; category: string },
  now: Date = new Date(),
): ClientRetrievalJobSummary {
  const slaRemainingSeconds = computeSlaRemainingSeconds(job.dueAt, now);
  const summary: ClientRetrievalJobSummary = {
    id: String(job._id),
    fileId: String(job.fileId),
    filename: file.filename,
    fileType: file.fileType,
    category: file.category,
    status: job.status,
    dueAt: job.dueAt.toISOString(),
    createdAt: (job.createdAt ?? new Date()).toISOString(),
    slaRemainingSeconds,
    slaOverdue: slaRemainingSeconds < 0,
  };

  if (job.status === "ready" && job.downloadToken && job.downloadExpiresAt) {
    if (job.downloadExpiresAt.getTime() > now.getTime()) {
      summary.downloadUrl = buildDownloadPath(job.downloadToken);
      summary.downloadExpiresAt = job.downloadExpiresAt.toISOString();
    }
  }

  return summary;
}

export async function createRetrievalJob(
  clientId: string,
  userId: string,
  fileId: string,
  ipAddress?: string,
): Promise<ClientRetrievalJobSummary> {
  if (!isValidObjectId(fileId)) {
    throw new ValidationError("fileId must be a valid identifier");
  }

  const file = await FileModel.findOne({
    _id: new Types.ObjectId(fileId),
    clientId: new Types.ObjectId(clientId),
  }).lean();

  if (!file) {
    throw new NotFoundError("File not found");
  }

  if (file.status !== "on_tape") {
    throw new ValidationError("File is not available for retrieval");
  }

  const existing = await RetrievalJobModel.findOne({
    clientId: new Types.ObjectId(clientId),
    fileId: new Types.ObjectId(fileId),
    status: { $in: ACTIVE_RETRIEVAL_STATUSES },
  }).lean();

  if (existing) {
    throw new ValidationError("A retrieval request is already active for this file");
  }

  const createdAt = new Date();
  const dueAt = computeDueAt(createdAt);

  const job = await RetrievalJobModel.create({
    clientId: new Types.ObjectId(clientId),
    fileId: new Types.ObjectId(fileId),
    requestedBy: new Types.ObjectId(userId),
    status: "pending",
    dueAt,
  });

  await recordAuditEvent({
    action: "retrieval.job_requested",
    userId: new Types.ObjectId(userId),
    clientId: new Types.ObjectId(clientId),
    ipAddress,
    payload: {
      retrievalJobId: String(job._id),
      fileId,
      dueAt: dueAt.toISOString(),
    },
  });

  await enqueueUnassignedAlert(String(job._id));

  return toClientSummary(job, file, createdAt);
}

export async function getRetrievalJobForClient(
  clientId: string,
  jobId: string,
): Promise<ClientRetrievalJobSummary> {
  if (!isValidObjectId(jobId)) {
    throw new NotFoundError("Retrieval job not found");
  }

  const job = await RetrievalJobModel.findOne({
    _id: new Types.ObjectId(jobId),
    clientId: new Types.ObjectId(clientId),
  }).lean();

  if (!job) {
    throw new NotFoundError("Retrieval job not found");
  }

  const file = await FileModel.findById(job.fileId)
    .select("filename fileType category")
    .lean();

  if (!file) {
    throw new NotFoundError("File not found for retrieval job");
  }

  return toClientSummary(job, file);
}

export type ListRetrievalJobsParams = {
  status?: string;
  limit?: number;
  offset?: number;
};

export async function listRetrievalJobsForClient(
  clientId: string,
  params: ListRetrievalJobsParams = {},
): Promise<RetrievalJobListResponse> {
  const filter: Record<string, unknown> = {
    clientId: new Types.ObjectId(clientId),
  };

  const status = params.status?.trim();
  if (status) {
    filter.status = status;
  }

  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);

  const [jobs, total] = await Promise.all([
    RetrievalJobModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    RetrievalJobModel.countDocuments(filter),
  ]);

  if (jobs.length === 0) {
    return { jobs: [], total };
  }

  const fileIds = jobs.map((j) => j.fileId);
  const files = await FileModel.find({ _id: { $in: fileIds } })
    .select("filename fileType category")
    .lean();
  const fileById = new Map(files.map((f) => [String(f._id), f]));

  const summaries: ClientRetrievalJobSummary[] = [];
  for (const job of jobs) {
    const file = fileById.get(String(job.fileId));
    if (!file) continue;
    summaries.push(toClientSummary(job, file));
  }

  return { jobs: summaries, total };
}
