import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

export async function hashReadableStream(stream: Readable): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of stream) {
    hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return hash.digest("hex");
}
