import { TapeModel } from "../../db/schemas/tape.js";
import { computeTapeAgeDays, computeTapeHealthScore } from "./health.js";

export type AdminTapeSummary = {
  barcode: string;
  rack: string;
  slot: string;
  status: string;
  fillPercent: number;
  healthScore: "green" | "amber" | "red";
  writeCycles: number;
  ageDays: number;
  purchasedAt?: string;
  sealedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TapeListResponse = {
  tapes: AdminTapeSummary[];
  total: number;
};

export async function listTapes(): Promise<TapeListResponse> {
  const tapes = await TapeModel.find().sort({ rack: 1, slot: 1 }).lean();
  const summaries: AdminTapeSummary[] = tapes.map((tape) => {
    const healthScore = computeTapeHealthScore({
      writeCycles: tape.writeCycles,
      fillPercent: tape.fillPercent,
      purchasedAt: tape.purchasedAt,
    });

    return {
      barcode: tape.barcode,
      rack: tape.rack,
      slot: tape.slot,
      status: tape.status,
      fillPercent: tape.fillPercent,
      healthScore,
      writeCycles: tape.writeCycles,
      ageDays: computeTapeAgeDays(tape.purchasedAt),
      purchasedAt: tape.purchasedAt?.toISOString(),
      sealedAt: tape.sealedAt?.toISOString(),
      createdAt: (tape.createdAt ?? new Date()).toISOString(),
      updatedAt: (tape.updatedAt ?? new Date()).toISOString(),
    };
  });

  return { tapes: summaries, total: summaries.length };
}
