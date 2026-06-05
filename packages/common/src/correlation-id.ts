import { randomUUID } from "node:crypto";

export const CORRELATION_HEADER = "x-correlation-id";

export function generateCorrelationId(): string {
  return randomUUID();
}

export function resolveCorrelationId(header?: string | string[]): string {
  if (typeof header === "string" && header.trim()) return header.trim();
  if (Array.isArray(header) && header[0]?.trim()) return header[0].trim();
  return generateCorrelationId();
}
