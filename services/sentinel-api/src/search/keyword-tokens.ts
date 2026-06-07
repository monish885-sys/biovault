import { normalizeSearchText, hmacSearchToken } from "./tokens.js";

/** HMAC-SHA256 tokens for keyword metadata — never index raw keyword strings. */
export function buildKeywordSearchTokens(
  metadata: Map<string, string> | Record<string, string> | undefined,
  clientId: string,
): string[] {
  if (!metadata) return [];

  const values = metadata instanceof Map ? [...metadata.values()] : Object.values(metadata);
  const tokens = new Set<string>();

  for (const value of values) {
    const normalized = normalizeSearchText(value);
    if (!normalized) continue;
    for (const part of normalized.split(/\s+/).filter(Boolean)) {
      tokens.add(hmacSearchToken(clientId, part));
    }
  }

  return [...tokens];
}
