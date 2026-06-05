import { Types } from "mongoose";
import { NotFoundError, ValidationError } from "@biovault/common";
import { ClientModel } from "../../db/schemas/client.js";
import { recordAuditEvent } from "../audit/audit.service.js";

export type ClientProfile = {
  id: string;
  name: string;
  slug: string;
  tier: string;
  retentionPolicyYears: number;
  dataCategories: string[];
  onboardingComplete: boolean;
};

function toProfile(doc: {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  tier: string;
  retentionPolicyYears: number;
  dataCategories?: string[];
  onboardingComplete?: boolean;
}): ClientProfile {
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

export async function getClientProfile(clientId: string): Promise<ClientProfile> {
  if (!Types.ObjectId.isValid(clientId)) {
    throw new NotFoundError("Client not found");
  }
  const client = await ClientModel.findById(clientId).lean();
  if (!client?.active) {
    throw new NotFoundError("Client not found");
  }
  return toProfile(client);
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

  return toProfile(client);
}
