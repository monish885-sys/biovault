import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashReadableStream } from "./stream-hash.js";

describe("hashReadableStream", () => {
  it("computes SHA-256 of streamed bytes", async () => {
    const payload = Buffer.from("stream-hash-fixture");
    const expected = createHash("sha256").update(payload).digest("hex");
    const hash = await hashReadableStream(Readable.from(payload));
    expect(hash).toBe(expected);
  });
});
