import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import type {
  DriveState,
  FileLocator,
  TapeLibraryAdapter,
  WriteResult,
} from "./adapter.js";

/** In-memory LTO-9 cartridge simulator for dev/demo (Day 4+). */
export class TapeSimulator implements TapeLibraryAdapter {
  private readonly cartridges = new Map<string, Buffer[]>();
  private mounted: string | null = null;

  async listDrives(): Promise<DriveState[]> {
    return [{ id: "sim-drive-0", mountedBarcode: this.mounted }];
  }

  async mount(barcode: string): Promise<void> {
    if (!this.cartridges.has(barcode)) this.cartridges.set(barcode, []);
    this.mounted = barcode;
  }

  async unmount(barcode: string): Promise<void> {
    if (this.mounted === barcode) this.mounted = null;
  }

  async writeSequential(barcode: string, stream: Readable): Promise<WriteResult> {
    const chunks: Buffer[] = [];
    const hash = createHash("sha256");
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      hash.update(buf);
    }
    const data = Buffer.concat(chunks);
    const blocks = this.cartridges.get(barcode) ?? [];
    const byteOffset = blocks.reduce((n, b) => n + b.length, 0);
    const blockId = `blk-${blocks.length}`;
    blocks.push(data);
    this.cartridges.set(barcode, blocks);
    return {
      blockId,
      byteOffset,
      bytesWritten: data.length,
      checksumSha256: hash.digest("hex"),
    };
  }

  async readSequential(barcode: string, locator: FileLocator): Promise<Readable> {
    const blocks = this.cartridges.get(barcode);
    if (!blocks) throw new Error(`Unknown tape: ${barcode}`);
    const idx = Number.parseInt(locator.blockId.replace("blk-", ""), 10);
    const block = blocks[idx];
    if (!block) throw new Error(`Missing block ${locator.blockId}`);
    return Readable.from(block.subarray(locator.byteOffset));
  }
}
