type Props = {
  portal: "client" | "admin";
};

export function DemoBanner({ portal }: Props) {
  const accent =
    portal === "client"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : "border-amber-500/40 bg-amber-500/10 text-amber-200";

  return (
    <div
      className={`border-b px-4 py-2 text-center text-xs sm:text-sm ${accent}`}
      role="status"
    >
      <strong>Demo sandbox</strong> — simulated LTO-9 tape, no real PHI. Data may reset periodically.{" "}
      <a href="/" className="underline hover:opacity-80">
        Back to biovault.in
      </a>
    </div>
  );
}
