import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform, type Readable } from "node:stream";
import { createHash } from "node:crypto";
import { getStagingPath } from "../config.js";
import type {
  DriveState,
  FileLocator,
  TapeLibraryAdapter,
  WriteResult,
} from "./adapter.js";

function stagingRoot(): string {
  return getStagingPath();
}

function cartridgeDir(barcode: string): string {
  return join(stagingRoot(), "tape-sim", barcode);
}

function blockFilePath(barcode: string, blockId: string): string {
  return join(cartridgeDir(barcode), `${blockId}.bin`);
}

async function cartridgeStats(barcode: string): Promise<{ blockCount: number; totalBytes: number }> {
  const dir = cartridgeDir(barcode);
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir);
  let blockCount = 0;
  let totalBytes = 0;
  for (const entry of entries) {
    if (!entry.startsWith("blk-") || !entry.endsWith(".bin")) continue;
    blockCount += 1;
    const info = await stat(join(dir, entry));
    totalBytes += info.size;
  }
  return { blockCount, totalBytes };
}

/** Disk-backed LTO-9 cartridge simulator — blocks live under STAGING_PATH/tape-sim. */
export class TapeSimulator implements TapeLibraryAdapter {
  private mounted: string | null = null;

  async listDrives(): Promise<DriveState[]> {
    return [{ id: "sim-drive-0", mountedBarcode: this.mounted }];
  }

  async mount(barcode: string): Promise<void> {
    await mkdir(cartridgeDir(barcode), { recursive: true });
    this.mounted = barcode;
  }

  async unmount(barcode: string): Promise<void> {
    if (this.mounted === barcode) this.mounted = null;
  }

  async writeSequential(barcode: string, stream: Readable): Promise<WriteResult> {
    const { blockCount, totalBytes } = await cartridgeStats(barcode);
    const blockId = `blk-${blockCount}`;
    const dest = blockFilePath(barcode, blockId);

    const hash = createHash("sha256");
    let bytesWritten = 0;
    const hasher = new Transform({
      transform(chunk, _enc, cb) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        hash.update(buf);
        bytesWritten += buf.length;
        cb(null, buf);
      },
    });

    await pipeline(stream, hasher, createWriteStream(dest));
    return {
      blockId,
      byteOffset: totalBytes,
      bytesWritten,
      checksumSha256: hash.digest("hex"),
    };
  }

  async readSequential(barcode: string, locator: FileLocator): Promise<Readable> {
    const path = blockFilePath(barcode, locator.blockId);
    try {
      await stat(path);
    } catch {
      throw new Error(`Missing block ${locator.blockId} on tape ${barcode}`);
    }
    return createReadStream(path);
  }
}
