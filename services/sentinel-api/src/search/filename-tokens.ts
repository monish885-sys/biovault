import { tokenizeSearchText } from "./tokens.js";

/** HMAC-SHA256 tokens for tenant-scoped filename search without indexing raw strings. */
export function buildFilenameSearchTokens(filename: string, clientId: string): string[] {
  return tokenizeSearchText(filename, clientId);
}
