import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform, type Readable } from "node:stream";
import { createHash } from "node:crypto";
import { config } from "../../config.js";

function stagingRoot(): string {
  return process.env.STAGING_PATH ?? config.stagingPath;
}

export function ingestJobDir(ingestJobId: string): string {
  return join(stagingRoot(), "ingest", ingestJobId);
}

export function stagedFilePath(ingestJobId: string, filename: string): string {
  return join(ingestJobDir(ingestJobId), filename);
}

export async function writeStagedFile(
  ingestJobId: string,
  filename: string,
  source: Readable,
): Promise<{ stagingPath: string; checksumSha256: string; sizeBytes: number }> {
  const dest = stagedFilePath(ingestJobId, filename);
  await mkdir(dirname(dest), { recursive: true });

  const hash = createHash("sha256");
  let sizeBytes = 0;
  const hasher = new Transform({
    transform(chunk, _enc, cb) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(buf);
      sizeBytes += buf.length;
      cb(null, buf);
    },
  });

  await pipeline(source, hasher, createWriteStream(dest));
  return { stagingPath: dest, checksumSha256: hash.digest("hex"), sizeBytes };
}
