import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TapeSimulator } from "./simulator.js";

describe("TapeSimulator", () => {
  let stagingDir: string;

  beforeEach(async () => {
    stagingDir = await mkdtemp(join(tmpdir(), "sentinel-tape-sim-"));
    vi.stubEnv("STAGING_PATH", stagingDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(stagingDir, { recursive: true, force: true });
  });

  it("writes and reads back identical bytes from disk blocks", async () => {
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
    expect(written.blockId).toBe("blk-0");
  });
});
