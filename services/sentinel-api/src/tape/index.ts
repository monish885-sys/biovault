import { config } from "../config.js";
import type { TapeLibraryAdapter } from "./adapter.js";
import { TapeSimulator } from "./simulator.js";

let adapter: TapeLibraryAdapter | null = null;

export function getTapeAdapter(): TapeLibraryAdapter {
  if (!adapter) {
    switch (config.tapeAdapter) {
      case "sim":
        adapter = new TapeSimulator();
        break;
      case "mtx":
      case "scalar":
        throw new Error(`Tape adapter "${config.tapeAdapter}" not implemented yet`);
      default:
        adapter = new TapeSimulator();
    }
  }
  return adapter;
}
