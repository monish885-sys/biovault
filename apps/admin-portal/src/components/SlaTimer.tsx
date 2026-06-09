type Props = {
  remainingSeconds: number;
  overdue: boolean;
};

function format(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${seconds < 0 ? "-" : ""}${m}:${String(s).padStart(2, "0")}`;
}

export function SlaTimer({ remainingSeconds, overdue }: Props) {
  const tone = overdue
    ? "text-red-400"
    : remainingSeconds < 300
      ? "text-amber-400"
      : "text-emerald-400";

  return (
    <span className={`font-mono text-sm font-semibold ${tone}`}>
      {overdue ? "OVERDUE " : ""}
      {format(remainingSeconds)}
    </span>
  );
}
