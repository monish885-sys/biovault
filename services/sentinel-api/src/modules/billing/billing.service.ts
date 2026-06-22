import { Types } from "mongoose";
import { ClientModel } from "../../db/schemas/client.js";
import { FileModel } from "../../db/schemas/file.js";
import { RetrievalJobModel } from "../../db/schemas/retrieval-job.js";
import {
  bytesToTb,
  CLOUD_GLACIER_INR_PER_TB,
  roundInr,
  roundTb,
  TIER_LIMITS,
  type TierKey,
} from "./tiers.js";

export type BillingSummary = {
  tier: TierKey;
  storageBytes: number;
  storageTb: number;
  storageIncludedTb: number;
  storageOverageTb: number;
  retrievalsUsed: number;
  retrievalsIncluded: number;
  retrievalsOverage: number;
  estimatedMonthlyInr: number;
  cloudComparisonInr: number;
  savingsVsCloudInr: number;
  byCategory: Array<{ category: string; bytes: number; tb: number }>;
};

export type InvoicePreview = {
  period: string;
  lineItems: Array<{ label: string; quantity: number; unitInr: number; totalInr: number }>;
  subtotalInr: number;
  estimatedTotalInr: number;
};

function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type StorageMetrics = {
  storageBytes: number;
  storageTb: number;
  byCategory: Array<{ category: string; bytes: number; tb: number }>;
};

export async function getStorageMetrics(clientId: string): Promise<StorageMetrics> {
  const cid = new Types.ObjectId(clientId);
  const files = await FileModel.find({
    clientId: cid,
    status: { $in: ["on_tape", "indexing", "pending_deletion"] },
  })
    .select("sizeBytes category")
    .lean();

  const storageBytes = files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);
  const storageTb = roundTb(bytesToTb(storageBytes));

  const categoryMap = new Map<string, number>();
  for (const f of files) {
    const cat = f.category ?? "uncategorized";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + (f.sizeBytes ?? 0));
  }
  const byCategory = [...categoryMap.entries()]
    .map(([category, bytes]) => ({ category, bytes, tb: roundTb(bytesToTb(bytes)) }))
    .sort((a, b) => b.bytes - a.bytes);

  return { storageBytes, storageTb, byCategory };
}

export async function getBillingSummary(clientId: string): Promise<BillingSummary> {
  const client = await ClientModel.findById(clientId).lean();
  if (!client) throw new Error("Client not found");

  const tier = (client.tier ?? "base") as TierKey;
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.base;

  const { storageBytes, storageTb, byCategory } = await getStorageMetrics(clientId);
  const cid = new Types.ObjectId(clientId);

  const retrievalsUsed = await RetrievalJobModel.countDocuments({
    clientId: cid,
    createdAt: { $gte: monthStart() },
    status: { $nin: ["failed"] },
  });

  const storageOverageTb = Math.max(0, storageTb - limits.storageTb);
  const retrievalsOverage = Math.max(0, retrievalsUsed - limits.retrievalsPerMonth);

  const storageCharge = storageTb * limits.pricePerTbInr;
  const excessRetrievalCharge = retrievalsOverage * limits.excessRetrievalInr;
  const estimatedMonthlyInr = roundInr(storageCharge + excessRetrievalCharge);

  const cloudComparisonInr = roundInr(storageTb * CLOUD_GLACIER_INR_PER_TB);

  return {
    tier,
    storageBytes,
    storageTb,
    storageIncludedTb: limits.storageTb,
    storageOverageTb: roundTb(storageOverageTb),
    retrievalsUsed,
    retrievalsIncluded: limits.retrievalsPerMonth,
    retrievalsOverage,
    estimatedMonthlyInr,
    cloudComparisonInr,
    savingsVsCloudInr: roundInr(cloudComparisonInr - estimatedMonthlyInr),
    byCategory,
  };
}

export async function getInvoicePreview(clientId: string): Promise<InvoicePreview> {
  const summary = await getBillingSummary(clientId);
  const limits = TIER_LIMITS[summary.tier] ?? TIER_LIMITS.base;
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const lineItems: InvoicePreview["lineItems"] = [
    {
      label: `Storage (${summary.storageTb} TB × ₹${limits.pricePerTbInr}/TB)`,
      quantity: summary.storageTb,
      unitInr: limits.pricePerTbInr,
      totalInr: roundInr(summary.storageTb * limits.pricePerTbInr),
    },
  ];

  if (summary.retrievalsOverage > 0) {
    lineItems.push({
      label: `Excess retrievals (${summary.retrievalsOverage} × ₹${limits.excessRetrievalInr})`,
      quantity: summary.retrievalsOverage,
      unitInr: limits.excessRetrievalInr,
      totalInr: roundInr(summary.retrievalsOverage * limits.excessRetrievalInr),
    });
  }

  const subtotalInr = lineItems.reduce((s, i) => s + i.totalInr, 0);

  return {
    period,
    lineItems,
    subtotalInr,
    estimatedTotalInr: subtotalInr,
  };
}
