import { Types } from "mongoose";
import { NotFoundError, ValidationError } from "@biovault/common";
import { ClientModel } from "../../db/schemas/client.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import { getStorageMetrics } from "../billing/billing.service.js";
import { TIER_LIMITS, type TierKey } from "../billing/tiers.js";

export type ClientVaultSummary = {
  storageTb: number;
  storageIncludedTb: number;
  storageRemainingTb: number;
  byCategory: Array<{ category: string; tb: number }>;
};

export type ClientProfile = {
  id: string;
  name: string;
  slug: string;
  tier: string;
  retentionPolicyYears: number;
  dataCategories: string[];
  onboardingComplete: boolean;
  vault: ClientVaultSummary;
};

function toProfile(doc: {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  tier: string;
  retentionPolicyYears: number;
  dataCategories?: string[];
  onboardingComplete?: boolean;
}): Omit<ClientProfile, "vault"> {
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    tier: doc.tier,
    retentionPolicyYears: doc.retentionPolicyYears,
    dataCategories: doc.dataCategories ?? [],
    onboardingComplete: Boolean(doc.onboardingComplete),
  };
}

async function buildVaultSummary(clientId: string, tier: string): Promise<ClientVaultSummary> {
  const limits = TIER_LIMITS[(tier as TierKey) ?? "base"] ?? TIER_LIMITS.base;
  const { storageTb, byCategory } = await getStorageMetrics(clientId);
  const storageIncludedTb = limits.storageTb;
  const storageRemainingTb = Math.max(0, Math.round((storageIncludedTb - storageTb) * 1000) / 1000);
  return {
    storageTb,
    storageIncludedTb,
    storageRemainingTb,
    byCategory: byCategory.map(({ category, tb }) => ({ category, tb })),
  };
}

export async function getClientProfile(clientId: string): Promise<ClientProfile> {
  if (!Types.ObjectId.isValid(clientId)) {
    throw new NotFoundError("Client not found");
  }
  const client = await ClientModel.findById(clientId).lean();
  if (!client?.active) {
    throw new NotFoundError("Client not found");
  }
  const vault = await buildVaultSummary(clientId, client.tier);
  return { ...toProfile(client), vault };
}

export async function updateOnboardingStub(
  clientId: string,
  userId: string,
  body: { dataCategories?: string[]; retentionPolicyYears?: number },
  ipAddress?: string,
): Promise<ClientProfile> {
  if (!Types.ObjectId.isValid(clientId)) {
    throw new NotFoundError("Client not found");
  }
  const updates: Record<string, unknown> = {};
  if (body.dataCategories !== undefined) {
    if (!Array.isArray(body.dataCategories) || body.dataCategories.some((c) => typeof c !== "string")) {
      throw new ValidationError("dataCategories must be an array of strings");
    }
    updates.dataCategories = body.dataCategories;
  }
  if (body.retentionPolicyYears !== undefined) {
    const years = Number(body.retentionPolicyYears);
    if (!Number.isFinite(years) || years < 1 || years > 50) {
      throw new ValidationError("retentionPolicyYears must be between 1 and 50");
    }
    updates.retentionPolicyYears = years;
  }
  if (Object.keys(updates).length === 0) {
    throw new ValidationError("No onboarding fields to update");
  }
  updates.onboardingComplete = true;

  const client = await ClientModel.findOneAndUpdate(
    { _id: clientId, active: true },
    { $set: updates },
    { new: true },
  ).lean();
  if (!client) {
    throw new NotFoundError("Client not found");
  }

  await recordAuditEvent({
    action: "clients.onboarding_update",
    userId: new Types.ObjectId(userId),
    clientId: new Types.ObjectId(clientId),
    ipAddress,
    payload: updates,
  });

  return getClientProfile(clientId);
}
