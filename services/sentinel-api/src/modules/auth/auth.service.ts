import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { UnauthorizedError, ValidationError } from "@biovault/common";
import { UserModel } from "../../db/schemas/user.js";
import { isClientRole } from "./permissions.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import type { UserRole } from "../../db/schemas/user.js";
import { clearSessionCookie, portalForRole, setSessionCookie, signSession } from "./session.js";
import type { Response } from "express";

export type PublicUser = {
  id: string;
  email: string;
  role: string;
  clientId?: string;
  mfaEnabled: boolean;
};

function toPublicUser(doc: {
  _id: { toString(): string };
  email: string;
  role: string;
  clientId?: { toString(): string } | null;
  mfaEnabled?: boolean;
}): PublicUser {
  return {
    id: doc._id.toString(),
    email: doc.email,
    role: doc.role,
    clientId: doc.clientId ? doc.clientId.toString() : undefined,
    mfaEnabled: Boolean(doc.mfaEnabled),
  };
}

export async function login(
  email: string,
  password: string,
  res: Response,
  ipAddress?: string,
): Promise<PublicUser> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) {
    throw new ValidationError("Email and password are required");
  }

  const user = await UserModel.findOne({ email: normalized }).lean();
  if (!user?.active) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (isClientRole(user.role) && !user.clientId) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const token = signSession({
    sub: String(user._id),
    role: user.role,
    clientId: user.clientId ? String(user.clientId) : undefined,
  });
  setSessionCookie(res, token, portalForRole(user.role));

  await recordAuditEvent({
    action: "auth.login",
    userId: new Types.ObjectId(user._id.toString()),
    clientId: user.clientId ? new Types.ObjectId(user.clientId.toString()) : undefined,
    ipAddress,
    payload: { email: normalized, role: user.role },
  });

  return toPublicUser(user);
}

export async function logout(
  userId: string | undefined,
  clientId: string | undefined,
  role: string | undefined,
  res: Response,
  ipAddress?: string,
): Promise<void> {
  if (role) {
    clearSessionCookie(res, portalForRole(role as UserRole));
  } else {
    clearSessionCookie(res, "client");
    clearSessionCookie(res, "ops");
  }
  if (userId && Types.ObjectId.isValid(userId)) {
    await recordAuditEvent({
      action: "auth.logout",
      userId: new Types.ObjectId(userId),
      clientId: clientId && Types.ObjectId.isValid(clientId) ? new Types.ObjectId(clientId) : undefined,
      ipAddress,
      payload: {},
    });
  }
}

export async function resolveSessionUser(session: {
  sub: string;
  role: string;
  clientId?: string;
}): Promise<PublicUser> {
  if (!Types.ObjectId.isValid(session.sub)) {
    throw new UnauthorizedError("Session invalid");
  }
  const user = await UserModel.findById(session.sub).lean();
  if (!user?.active) {
    throw new UnauthorizedError("Session invalid");
  }
  return toPublicUser(user);
}
