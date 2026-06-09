import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { basename } from "node:path";
import { Types } from "mongoose";
import { NotFoundError, ValidationError } from "@biovault/common";
import { RetrievalJobModel } from "../../db/schemas/retrieval-job.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import { verifyDownloadToken } from "./download-token.js";
import { purgeRetrievalStaging } from "./staging.js";

export type DownloadFulfillment = {
  stream: ReturnType<typeof createReadStream>;
  filename: string;
  contentType: string;
  retrievalJobId: string;
  clientId: string;
};

export async function fulfillRetrievalDownload(
  signedToken: string,
  ipAddress?: string,
): Promise<DownloadFulfillment> {
  const payload = verifyDownloadToken(signedToken);
  if (!payload) {
    throw new ValidationError("Download link is invalid or expired");
  }

  const job = await RetrievalJobModel.findById(payload.jobId);
  if (!job) {
    throw new NotFoundError("Retrieval job not found");
  }

  if (job.status !== "ready") {
    throw new ValidationError("Download is no longer available");
  }

  if (!job.downloadToken || job.downloadToken !== signedToken) {
    throw new ValidationError("Download link is invalid or expired");
  }

  if (!job.stagingPath) {
    throw new ValidationError("Staging file missing for retrieval job");
  }

  try {
    await access(job.stagingPath);
  } catch {
    throw new NotFoundError("Staged file not found");
  }

  const retrievalJobId = String(job._id);
  const stagingPath = job.stagingPath;

  job.status = "delivered";
  job.downloadToken = undefined;
  job.downloadExpiresAt = undefined;
  await job.save();

  await recordAuditEvent({
    action: "retrieval.downloaded",
    clientId: job.clientId as Types.ObjectId,
    ipAddress,
    payload: {
      retrievalJobId,
      fileId: String(job.fileId),
    },
  });

  const filename = basename(stagingPath);
  return {
    stream: createReadStream(stagingPath),
    filename,
    contentType: "application/octet-stream",
    retrievalJobId,
    clientId: String(job.clientId),
  };
}

export async function purgeRetrievalAfterDownload(
  retrievalJobId: string,
  clientId: string,
  ipAddress?: string,
): Promise<void> {
  await purgeRetrievalStaging(retrievalJobId);

  await recordAuditEvent({
    action: "retrieval.staging_purged",
    clientId: new Types.ObjectId(clientId),
    ipAddress,
    payload: { retrievalJobId, reason: "download" },
  });
}

export async function expireRetrievalDownload(jobId: string): Promise<void> {
  const job = await RetrievalJobModel.findById(jobId);
  if (!job) return;

  if (job.status !== "ready") return;

  job.status = "expired";
  job.downloadToken = undefined;
  job.downloadExpiresAt = undefined;
  await job.save();

  await purgeRetrievalStaging(jobId);

  await recordAuditEvent({
    action: "retrieval.expired",
    clientId: job.clientId as Types.ObjectId,
    payload: { retrievalJobId: jobId, fileId: String(job.fileId) },
  });

  await recordAuditEvent({
    action: "retrieval.staging_purged",
    clientId: job.clientId as Types.ObjectId,
    payload: { retrievalJobId: jobId, reason: "ttl" },
  });
}
