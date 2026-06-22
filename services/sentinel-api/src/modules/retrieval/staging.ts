import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { getStagingPath } from "../../config.js";

function stagingRoot(): string {
  return getStagingPath();
}

export function retrievalJobDir(retrievalJobId: string): string {
  return join(stagingRoot(), "retrieval", retrievalJobId);
}

export function stagedRetrievalPath(retrievalJobId: string, filename: string): string {
  return join(retrievalJobDir(retrievalJobId), filename);
}

export async function writeRetrievalStagingFile(
  retrievalJobId: string,
  filename: string,
  source: Readable,
): Promise<string> {
  const dest = stagedRetrievalPath(retrievalJobId, filename);
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(source, createWriteStream(dest));
  return dest;
}

export async function purgeRetrievalStaging(retrievalJobId: string): Promise<void> {
  await rm(retrievalJobDir(retrievalJobId), { recursive: true, force: true });
}
