import { createHmac, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import { config } from "../../config.js";
import type { UserRole } from "../../db/schemas/user.js";

export const SESSION_COOKIE = "sentinel_session";

export type SessionPayload = {
  sub: string;
  role: UserRole;
  clientId?: string;
  exp: number;
};

export function signSession(
  payload: Pick<SessionPayload, "sub" | "role" | "clientId">,
  ttlSeconds = config.sessionTtlSeconds,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp } satisfies SessionPayload)).toString(
    "base64url",
  );
  const sig = createHmac("sha256", config.sessionSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", config.sessionSecret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
  if (!payload.sub || !payload.role || typeof payload.exp !== "number") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    maxAge: config.sessionTtlSeconds * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}
