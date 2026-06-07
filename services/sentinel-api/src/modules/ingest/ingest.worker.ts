import { Worker } from "bullmq";
import { createLogger } from "@biovault/common";
import { config } from "../../config.js";
import { INGEST_QUEUE_NAME, type TapeWriteJobData } from "./ingest.queue.js";
import { processTapeWrite, processTapeVerify } from "./ingest.service.js";

const log = createLogger("ingest-worker", config.logLevel);

let worker: Worker<TapeWriteJobData> | null = null;

export function startIngestWorker(): Worker<TapeWriteJobData> {
  if (worker) return worker;

  worker = new Worker<TapeWriteJobData>(
    INGEST_QUEUE_NAME,
    async (job) => {
      log.info("tape-write started", { ingestJobId: job.data.ingestJobId });
      await processTapeWrite(job.data.ingestJobId);
      log.info("tape-verify started", { ingestJobId: job.data.ingestJobId });
      await processTapeVerify(job.data.ingestJobId);
      log.info("tape pipeline finished", { ingestJobId: job.data.ingestJobId });
    },
    { connection: { url: config.redisUrl }, concurrency: 1 },
  );

  worker.on("failed", (job, err) => {
    log.error("tape-write failed", {
      ingestJobId: job?.data.ingestJobId,
      error: err.message,
    });
  });

  return worker;
}

export async function stopIngestWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
