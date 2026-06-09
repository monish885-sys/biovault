import { RETRIEVAL_SLA_MS } from "./retrieval.constants.js";

export function computeDueAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + RETRIEVAL_SLA_MS);
}

/** Seconds until SLA deadline; negative when overdue. */
export function computeSlaRemainingSeconds(dueAt: Date, now: Date = new Date()): number {
  return Math.round((dueAt.getTime() - now.getTime()) / 1000);
}
