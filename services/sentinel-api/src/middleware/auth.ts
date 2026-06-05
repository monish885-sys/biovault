import type { RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "@biovault/common";
import type { UserRole } from "../db/schemas/user.js";
import { isClientRole, isInternalRole } from "../modules/auth/permissions.js";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "../modules/auth/session.js";

export type AuthUser = SessionPayload;

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

function readSessionToken(req: Parameters<RequestHandler>[0]): string | undefined {
  const raw = req.cookies?.[SESSION_COOKIE];
  return typeof raw === "string" ? raw : undefined;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readSessionToken(req);
  if (!token) {
    next(new UnauthorizedError("Sign in required"));
    return;
  }
  const session = verifySession(token);
  if (!session) {
    next(new UnauthorizedError("Session expired or invalid"));
    return;
  }
  req.auth = session;
  next();
};

export function requireRoles(...allowed: readonly UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new UnauthorizedError("Sign in required"));
      return;
    }
    if (!(allowed as readonly string[]).includes(req.auth.role)) {
      next(new ForbiddenError("Insufficient permissions for this action"));
      return;
    }
    next();
  };
}

/** Client portal routes — must belong to a tenant */
export const requireClientUser: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(new UnauthorizedError("Sign in required"));
    return;
  }
  if (!isClientRole(req.auth.role)) {
    next(new ForbiddenError("Client account required"));
    return;
  }
  if (!req.auth.clientId) {
    next(new ForbiddenError("User is not linked to a client tenant"));
    return;
  }
  next();
};

/** Admin / technician routes */
export const requireInternalUser: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(new UnauthorizedError("Sign in required"));
    return;
  }
  if (!isInternalRole(req.auth.role)) {
    next(new ForbiddenError("Internal operations account required"));
    return;
  }
  next();
};
