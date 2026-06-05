import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { TapeSimulator } from "./simulator.js";

describe("TapeSimulator", () => {
  it("writes and reads back identical bytes", async () => {
    const sim = new TapeSimulator();
    const barcode = "LTO9-TEST-001";
    await sim.mount(barcode);
    const payload = Buffer.from("sentinel-fixture");
    const written = await sim.writeSequential(barcode, Readable.from(payload));
    const stream = await sim.readSequential(barcode, {
      blockId: written.blockId,
      byteOffset: written.byteOffset,
    });
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    expect(Buffer.concat(chunks).equals(payload)).toBe(true);
    expect(written.checksumSha256).toHaveLength(64);
  });
});
