import { Queue } from "bullmq";
import { config } from "../../config.js";
import { UNASSIGNED_ALERT_DELAY_MS } from "./retrieval.constants.js";

export const RETRIEVAL_QUEUE_NAME = "retrieval";

export type RetrievalQueueJobData = {
  retrievalJobId: string;
};

let retrievalQueue: Queue<RetrievalQueueJobData> | null = null;

export function getRetrievalQueue(): Queue<RetrievalQueueJobData> {
  if (!retrievalQueue) {
    retrievalQueue = new Queue<RetrievalQueueJobData>(RETRIEVAL_QUEUE_NAME, {
      connection: { url: config.redisUrl },
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: "fixed", delay: 5000 },
      },
    });
  }
  return retrievalQueue;
}

export async function enqueueUnassignedAlert(retrievalJobId: string): Promise<void> {
  await getRetrievalQueue().add(
    "unassigned-alert",
    { retrievalJobId },
    { delay: UNASSIGNED_ALERT_DELAY_MS, jobId: `unassigned-${retrievalJobId}` },
  );
}

export async function enqueueDownloadExpiry(
  retrievalJobId: string,
  delayMs: number,
): Promise<void> {
  await getRetrievalQueue().add(
    "download-expiry",
    { retrievalJobId },
    { delay: delayMs, jobId: `download-expiry-${retrievalJobId}` },
  );
}
