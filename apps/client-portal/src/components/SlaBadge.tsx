type Props = {
  remainingSeconds: number;
  overdue: boolean;
};

function formatSla(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const label = `${m}:${String(s).padStart(2, "0")}`;
  return seconds < 0 ? `-${label}` : label;
}

export function SlaBadge({ remainingSeconds, overdue }: Props) {
  const tone = overdue
    ? "bg-red-500/20 text-red-300 border-red-500/40"
    : remainingSeconds < 300
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-mono ${tone}`}>
      {overdue ? "OVERDUE " : "SLA "}
      {formatSla(remainingSeconds)}
    </span>
  );
}
