import { computeTapeSlots, overallFillPercent } from "../../lib/storage-math";
import { LtoTapeCartridge } from "./LtoTapeCartridge";

type Props = {
  usedTb: number;
  capacityTb: number;
  compact?: boolean;
};

export function TapeShelfVisual({ usedTb, capacityTb, compact = false }: Props) {
  const slots = computeTapeSlots(usedTb, capacityTb);
  const overall = overallFillPercent(usedTb, capacityTb);
  const remainingTb = Math.max(0, Math.round((capacityTb - usedTb) * 1000) / 1000);

  return (
    <div className="vault-card overflow-hidden p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Your archive vault</h3>
          <p className="mt-1 text-sm text-slate-400">
            Patient records are stored on secure LTO-9 tapes in our offline vault — not in the cloud.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-emerald-400/80">Space remaining</p>
          <p className="text-2xl font-bold text-emerald-300">{remainingTb} TB</p>
          <p className="text-xs text-slate-500">of {capacityTb} TB in your plan</p>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="mb-5">
        <div className="mb-1.5 flex justify-between text-xs text-slate-400">
          <span>{usedTb} TB stored</span>
          <span>{overall}% of plan used</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
            style={{ width: `${overall}%` }}
          />
        </div>
      </div>

      {/* Tape shelf */}
      <div className="relative rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900/80 to-slate-950 p-4 pt-6">
        <div className="flex flex-wrap items-end justify-center gap-3 md:gap-5">
          {slots.map((slot) => (
            <LtoTapeCartridge
              key={slot.index}
              fillPercent={slot.fillPercent}
              size={compact ? "sm" : slots.length > 4 ? "sm" : "md"}
              highlight={slot.isPartial}
              label={slot.isEmpty ? "Empty slot" : slot.isPartial ? "In use" : "Full"}
              sublabel={slot.usedTb > 0 ? `${slot.usedTb} TB` : `${slot.capacityTb} TB free`}
            />
          ))}
        </div>
        {/* Shelf ledge */}
        <div className="mt-3 h-2 rounded-b-lg bg-gradient-to-b from-slate-600 to-slate-800 shadow-inner" />
        <div className="mx-auto mt-1 h-1 w-[95%] rounded-full bg-slate-700/50" />
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        Each cartridge holds up to 18 TB · Tapes stay air-gapped for maximum security
      </p>
    </div>
  );
}
