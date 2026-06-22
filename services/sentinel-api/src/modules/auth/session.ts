import type { Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../../config.js";
import type { UserRole } from "../../db/schemas/user.js";

const CLIENT_ROLES: readonly UserRole[] = [
  "client_admin",
  "client_viewer",
  "compliance_officer",
];

/** Legacy name — client portal cookie (kept for tests referencing the constant). */
export const SESSION_COOKIE = "sentinel_session_client";

export const SESSION_COOKIE_CLIENT = "sentinel_session_client";
export const SESSION_COOKIE_OPS = "sentinel_session_ops";

export type SessionPortal = "client" | "ops";

export type SessionPayload = {
  sub: string;
  role: UserRole;
  clientId?: string;
  exp: number;
};

export function portalForRole(role: UserRole): SessionPortal {
  return CLIENT_ROLES.includes(role) ? "client" : "ops";
}

export function cookieNameForPortal(portal: SessionPortal): string {
  return portal === "client" ? SESSION_COOKIE_CLIENT : SESSION_COOKIE_OPS;
}

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

export function setSessionCookie(res: Response, token: string, portal: SessionPortal): void {
  res.cookie(cookieNameForPortal(portal), token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    maxAge: config.sessionTtlSeconds * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response, portal: SessionPortal): void {
  res.clearCookie(cookieNameForPortal(portal), { path: "/" });
}

/** Read session token for the portal indicated by X-Sentinel-Portal, or first valid cookie. */
export function readSessionTokenFromRequest(
  cookies: Record<string, unknown> | undefined,
  portalHint?: string,
): string | undefined {
  const clientRaw = cookies?.[SESSION_COOKIE_CLIENT];
  const opsRaw = cookies?.[SESSION_COOKIE_OPS];

  // Strict portal isolation — never cross-read cookies when hint is set
  if (portalHint === "client") {
    return typeof clientRaw === "string" ? clientRaw : undefined;
  }
  if (portalHint === "ops") {
    return typeof opsRaw === "string" ? opsRaw : undefined;
  }

  if (typeof clientRaw === "string") return clientRaw;
  if (typeof opsRaw === "string") return opsRaw;

  const legacy = cookies?.["sentinel_session"];
  return typeof legacy === "string" ? legacy : undefined;
}
