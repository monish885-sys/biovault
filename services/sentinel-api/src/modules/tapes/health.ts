export type TapeHealthInput = {
  writeCycles: number;
  fillPercent: number;
  purchasedAt?: Date | null;
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function computeTapeHealthScore(tape: TapeHealthInput): "green" | "amber" | "red" {
  const ageYears =
    (Date.now() - (tape.purchasedAt?.getTime() ?? Date.now())) / MS_PER_YEAR;

  if (tape.writeCycles > 200 || ageYears >= 7 || tape.fillPercent >= 100) {
    return "red";
  }
  if (tape.writeCycles > 100 || ageYears >= 5 || tape.fillPercent >= 90) {
    return "amber";
  }
  return "green";
}

export function computeTapeAgeDays(purchasedAt?: Date | null): number {
  if (!purchasedAt) return 0;
  return Math.floor((Date.now() - purchasedAt.getTime()) / (24 * 60 * 60 * 1000));
}
