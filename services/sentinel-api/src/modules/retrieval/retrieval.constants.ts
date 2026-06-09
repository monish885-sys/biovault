/** Product SLA: retrieval due within 15 minutes of request. */
export const RETRIEVAL_SLA_MS = 15 * 60 * 1000;

/** Alert hook fires if job remains unassigned after 60 seconds. */
export const UNASSIGNED_ALERT_DELAY_MS = 60 * 1000;

/** Statuses that block a duplicate retrieval request for the same file. */
export const ACTIVE_RETRIEVAL_STATUSES = [
  "pending",
  "assigned",
  "in_progress",
  "ready",
] as const;

/** Time-limited download link TTL after job is marked ready. */
export const DOWNLOAD_TTL_MS = 60 * 60 * 1000;
