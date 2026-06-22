import { Types } from "mongoose";
import { NotFoundError, ValidationError } from "@biovault/common";
import { FileModel } from "../../db/schemas/file.js";
import { FileLocationModel } from "../../db/schemas/file-location.js";
import { RetrievalJobModel } from "../../db/schemas/retrieval-job.js";
import { getTapeAdapter } from "../../tape/index.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import { DOWNLOAD_TTL_MS } from "./retrieval.constants.js";
import { buildDownloadPath, signDownloadToken } from "./download-token.js";
import { enqueueDownloadExpiry } from "./retrieval.queue.js";
import { purgeRetrievalStaging, writeRetrievalStagingFile } from "./staging.js";

const ADMIN_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["assigned"],
  assigned: ["in_progress"],
  in_progress: [],
};

export type AdminRetrievalJobUpdate = {
  id: string;
  status: string;
};

export async function updateAdminRetrievalJobStatus(
  jobId: string,
  userId: string,
  nextStatus: string,
  ipAddress?: string,
): Promise<AdminRetrievalJobUpdate> {
  if (!Types.ObjectId.isValid(jobId)) {
    throw new NotFoundError("Retrieval job not found");
  }

  const job = await RetrievalJobModel.findById(jobId);
  if (!job) {
    throw new NotFoundError("Retrieval job not found");
  }

  const allowed = ADMIN_STATUS_TRANSITIONS[job.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new ValidationError(`Cannot transition from ${job.status} to ${nextStatus}`);
  }

  job.status = nextStatus as typeof job.status;
  if (nextStatus === "assigned") {
    job.set("assignedTo", new Types.ObjectId(userId));
  }
  await job.save();

  await recordAuditEvent({
    action: `retrieval.status_${nextStatus}`,
    userId: new Types.ObjectId(userId),
    clientId: job.clientId as Types.ObjectId,
    ipAddress,
    payload: { retrievalJobId: jobId, status: nextStatus },
  });

  return { id: jobId, status: job.status };
}

export type CompleteRetrievalResult = {
  id: string;
  status: string;
  downloadUrl: string;
  downloadExpiresAt: string;
};

/** Admin-facing response — no download URL; bytes stay client-only. */
export type AdminCompleteRetrievalResult = {
  id: string;
  status: string;
  downloadExpiresAt: string;
  stagedForClient: true;
};

export async function completeRetrievalJob(
  jobId: string,
  userId: string,
  ipAddress?: string,
): Promise<CompleteRetrievalResult> {
  if (!Types.ObjectId.isValid(jobId)) {
    throw new NotFoundError("Retrieval job not found");
  }

  const job = await RetrievalJobModel.findById(jobId);
  if (!job) {
    throw new NotFoundError("Retrieval job not found");
  }

  if (job.status !== "in_progress") {
    throw new ValidationError("Job must be in_progress before completion");
  }

  const file = await FileModel.findById(job.fileId).lean();
  if (!file) {
    throw new NotFoundError("File not found for retrieval job");
  }

  const location = await FileLocationModel.findOne({ fileId: job.fileId }).lean();
  if (!location) {
    throw new ValidationError("Tape location missing for file");
  }

  const adapter = getTapeAdapter();
  await adapter.mount(location.tapeBarcode);

  let stagingPath: string;
  try {
    const stream = await adapter.readSequential(location.tapeBarcode, location);
    stagingPath = await writeRetrievalStagingFile(jobId, file.filename, stream);
  } finally {
    await adapter.unmount(location.tapeBarcode);
  }

  const downloadExpiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS);
  const downloadToken = signDownloadToken(jobId, downloadExpiresAt);

  job.status = "ready";
  job.stagingPath = stagingPath;
  job.downloadToken = downloadToken;
  job.downloadExpiresAt = downloadExpiresAt;
  job.completedAt = new Date();
  if (!job.assignedTo) {
    job.set("assignedTo", new Types.ObjectId(userId));
  }
  await job.save();

  await recordAuditEvent({
    action: "retrieval.staged",
    userId: new Types.ObjectId(userId),
    clientId: job.clientId as Types.ObjectId,
    ipAddress,
    payload: {
      retrievalJobId: jobId,
      fileId: String(job.fileId),
      downloadExpiresAt: downloadExpiresAt.toISOString(),
    },
  });

  await recordAuditEvent({
    action: "retrieval.client_notified",
    userId: new Types.ObjectId(userId),
    clientId: job.clientId as Types.ObjectId,
    ipAddress,
    payload: {
      retrievalJobId: jobId,
      channel: "portal",
      note: "Client may download from Retrieval jobs when status is ready",
    },
  });

  await enqueueDownloadExpiry(jobId, DOWNLOAD_TTL_MS);

  const downloadUrl = buildDownloadPath(downloadToken);

  return {
    id: jobId,
    status: job.status,
    downloadUrl,
    downloadExpiresAt: downloadExpiresAt.toISOString(),
  };
}

export function toAdminCompleteResult(result: CompleteRetrievalResult): AdminCompleteRetrievalResult {
  return {
    id: result.id,
    status: result.status,
    downloadExpiresAt: result.downloadExpiresAt,
    stagedForClient: true,
  };
}
