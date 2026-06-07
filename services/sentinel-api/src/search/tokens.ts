import { createHmac } from "node:crypto";
import { config } from "../config.js";

export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function hmacSearchToken(clientId: string, token: string): string {
  return createHmac("sha256", config.searchTokenSecret)
    .update(`${clientId}:${token}`)
    .digest("hex");
}

export function tokenizeSearchText(text: string, clientId: string): string[] {
  const normalized = normalizeSearchText(text);
  if (!normalized) return [];
  return [...new Set(normalized.split(/\s+/).filter(Boolean))].map((part) =>
    hmacSearchToken(clientId, part),
  );
}
