import {
  ALL_ROLES,
  CLIENT_ROLES,
  INTERNAL_ROLES,
  type UserRole,
} from "../../db/schemas/user.js";

export function isClientRole(role: UserRole): boolean {
  return (CLIENT_ROLES as readonly string[]).includes(role);
}

export function isInternalRole(role: UserRole): boolean {
  return (INTERNAL_ROLES as readonly string[]).includes(role);
}

export function isKnownRole(role: string): role is UserRole {
  return (ALL_ROLES as readonly string[]).includes(role);
}

/** Route-level RBAC for Day 2+ stubs and live handlers */
export const ROUTE_ROLES = {
  ingestCreate: ["client_admin"] as const,
  searchRead: CLIENT_ROLES,
  retrievalCreate: ["client_admin", "compliance_officer"] as const,
  adminOps: INTERNAL_ROLES,
  clientOnboarding: ["client_admin"] as const,
  clientProfile: CLIENT_ROLES,
} as const;
