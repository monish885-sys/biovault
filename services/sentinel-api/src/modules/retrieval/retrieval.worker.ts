import { Worker } from "bullmq";
import { createLogger } from "@biovault/common";
import { Types } from "mongoose";
import { config } from "../../config.js";
import { RetrievalJobModel } from "../../db/schemas/retrieval-job.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import { expireRetrievalDownload } from "./retrieval-download.js";
import { RETRIEVAL_QUEUE_NAME, type RetrievalQueueJobData } from "./retrieval.queue.js";

const log = createLogger("retrieval-worker", config.logLevel);

let worker: Worker<RetrievalQueueJobData> | null = null;

export function startRetrievalWorker(): Worker<RetrievalQueueJobData> {
  if (worker) return worker;

  worker = new Worker<RetrievalQueueJobData>(
    RETRIEVAL_QUEUE_NAME,
    async (job) => {
      if (job.name === "unassigned-alert") {
        await handleUnassignedAlert(job.data.retrievalJobId);
        return;
      }

      if (job.name === "download-expiry") {
        await handleDownloadExpiry(job.data.retrievalJobId);
        return;
      }
    },
    { connection: { url: config.redisUrl }, concurrency: 2 },
  );

  worker.on("failed", (job, err) => {
    log.error("retrieval worker job failed", {
      retrievalJobId: job?.data.retrievalJobId,
      jobName: job?.name,
      error: err.message,
    });
  });

  return worker;
}

async function handleUnassignedAlert(retrievalJobId: string): Promise<void> {
  const jobDoc = await RetrievalJobModel.findById(retrievalJobId).lean();
  if (!jobDoc) {
    log.warn("unassigned-alert skipped — job not found", { retrievalJobId });
    return;
  }

  if (jobDoc.status !== "pending" || jobDoc.assignedTo) {
    log.info("unassigned-alert skipped — job assigned or progressed", {
      retrievalJobId,
      status: jobDoc.status,
      assignedTo: jobDoc.assignedTo ? String(jobDoc.assignedTo) : undefined,
    });
    return;
  }

  log.warn("retrieval job unassigned past 60s SLA alert threshold", {
    retrievalJobId,
    clientId: String(jobDoc.clientId),
    fileId: String(jobDoc.fileId),
    dueAt: jobDoc.dueAt.toISOString(),
  });

  await recordAuditEvent({
    action: "retrieval.unassigned_alert",
    clientId: jobDoc.clientId as Types.ObjectId,
    payload: {
      retrievalJobId,
      fileId: String(jobDoc.fileId),
      dueAt: jobDoc.dueAt.toISOString(),
    },
  });
}

async function handleDownloadExpiry(retrievalJobId: string): Promise<void> {
  log.info("download-expiry check", { retrievalJobId });
  await expireRetrievalDownload(retrievalJobId);
}

export async function stopRetrievalWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
