import { Queue } from "bullmq";
import { config } from "../../config.js";

export const INGEST_QUEUE_NAME = "ingest";

export type TapeWriteJobData = {
  ingestJobId: string;
};

let ingestQueue: Queue<TapeWriteJobData> | null = null;

export function getIngestQueue(): Queue<TapeWriteJobData> {
  if (!ingestQueue) {
    ingestQueue = new Queue<TapeWriteJobData>(INGEST_QUEUE_NAME, {
      connection: { url: config.redisUrl },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  }
  return ingestQueue;
}

export async function enqueueTapeWrite(ingestJobId: string): Promise<void> {
  await getIngestQueue().add("tape-write", { ingestJobId });
}
