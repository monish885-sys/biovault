export const TIER_LIMITS = {
  base: { storageTb: 1, retrievalsPerMonth: 5, pricePerTbInr: 500, excessRetrievalInr: 200 },
  standard: { storageTb: 5, retrievalsPerMonth: 20, pricePerTbInr: 450, excessRetrievalInr: 150 },
  enterprise: {
    storageTb: 20,
    retrievalsPerMonth: 100,
    pricePerTbInr: 400,
    excessRetrievalInr: 100,
  },
} as const;

/** AWS S3 Glacier Deep Archive approximate INR/TB/month for comparison */
export const CLOUD_GLACIER_INR_PER_TB = 990;

export type TierKey = keyof typeof TIER_LIMITS;

export function bytesToTb(bytes: number): number {
  return bytes / (1024 ** 4);
}

export function roundTb(tb: number): number {
  return Math.round(tb * 1000) / 1000;
}

export function roundInr(amount: number): number {
  return Math.round(amount);
}
