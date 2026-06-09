import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../../config.js";

export type DownloadTokenPayload = {
  jobId: string;
  exp: number;
  nonce: string;
};

export function signDownloadToken(jobId: string, expiresAt: Date): string {
  const payload: DownloadTokenPayload = {
    jobId,
    exp: Math.floor(expiresAt.getTime() / 1000),
    nonce: randomBytes(16).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", config.downloadTokenSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyDownloadToken(token: string): DownloadTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", config.downloadTokenSecret).update(body).digest("base64url");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  let payload: DownloadTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DownloadTokenPayload;
  } catch {
    return null;
  }

  if (!payload.jobId || typeof payload.exp !== "number" || !payload.nonce) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function buildDownloadPath(token: string): string {
  return `/api/v1/retrieval/download?token=${encodeURIComponent(token)}`;
}
