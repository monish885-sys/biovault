import type { Readable } from "node:stream";

export interface FileLocator {
  blockId: string;
  byteOffset: number;
}

export interface DriveState {
  id: string;
  mountedBarcode: string | null;
}

export interface WriteResult {
  blockId: string;
  byteOffset: number;
  bytesWritten: number;
  checksumSha256: string;
}

export interface TapeLibraryAdapter {
  listDrives(): Promise<DriveState[]>;
  mount(barcode: string): Promise<void>;
  unmount(barcode: string): Promise<void>;
  writeSequential(barcode: string, stream: Readable): Promise<WriteResult>;
  readSequential(barcode: string, locator: FileLocator): Promise<Readable>;
}
