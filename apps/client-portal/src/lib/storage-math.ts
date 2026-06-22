/** Native capacity of one LTO-9 cartridge (TB). */
export const LTO9_CAPACITY_TB = 18;

export type TapeSlot = {
  index: number;
  fillPercent: number;
  usedTb: number;
  capacityTb: number;
  isPartial: boolean;
  isEmpty: boolean;
};

export function computeTapeSlots(usedTb: number, planCapacityTb: number): TapeSlot[] {
  const tapeCount = Math.max(1, Math.ceil(planCapacityTb / LTO9_CAPACITY_TB));
  const slots: TapeSlot[] = [];
  let remaining = usedTb;

  for (let i = 0; i < tapeCount; i++) {
    const usedOnTape = Math.min(LTO9_CAPACITY_TB, Math.max(0, remaining));
    const fillPercent = Math.round((usedOnTape / LTO9_CAPACITY_TB) * 100);
    slots.push({
      index: i + 1,
      fillPercent,
      usedTb: Math.round(usedOnTape * 1000) / 1000,
      capacityTb: LTO9_CAPACITY_TB,
      isPartial: usedOnTape > 0 && usedOnTape < LTO9_CAPACITY_TB,
      isEmpty: usedOnTape === 0,
    });
    remaining -= usedOnTape;
  }

  return slots;
}

export function overallFillPercent(usedTb: number, planCapacityTb: number): number {
  if (planCapacityTb <= 0) return 0;
  return Math.min(100, Math.round((usedTb / planCapacityTb) * 100));
}
