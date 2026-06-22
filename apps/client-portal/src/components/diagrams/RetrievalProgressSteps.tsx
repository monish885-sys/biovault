const STEPS = [
  { key: "pending", label: "Requested", icon: "📋" },
  { key: "assigned", label: "Assigned", icon: "👤" },
  { key: "in_progress", label: "Retrieving", icon: "📼" },
  { key: "ready", label: "Ready", icon: "✅" },
  { key: "delivered", label: "Downloaded", icon: "📥" },
] as const;

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  assigned: 1,
  in_progress: 2,
  ready: 3,
  delivered: 4,
  expired: 3,
  failed: -1,
};

type Props = {
  status: string;
};

export function RetrievalProgressSteps({ status }: Props) {
  const current = STATUS_ORDER[status] ?? 0;
  const isFailed = status === "failed" || status === "expired";

  return (
    <div className="mt-3" aria-label="Retrieval progress">
      <div className="flex items-center justify-between gap-1">
        {STEPS.map((step, i) => {
          const done = !isFailed && i <= current;
          const active = !isFailed && i === current;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <div
                    className={`h-0.5 flex-1 ${done ? "bg-emerald-500" : "bg-slate-700"}`}
                  />
                )}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm transition-all ${
                    active
                      ? "bg-emerald-500 ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-slate-900"
                      : done
                        ? "bg-emerald-600/80"
                        : "bg-slate-800 ring-1 ring-slate-600"
                  }`}
                >
                  {step.icon}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${i < current ? "bg-emerald-500" : "bg-slate-700"}`}
                  />
                )}
              </div>
              <p
                className={`mt-1.5 hidden text-[10px] font-medium sm:block ${
                  active ? "text-emerald-300" : done ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
      {isFailed && (
        <p className="mt-2 text-center text-xs text-red-400">
          {status === "expired" ? "Download link expired — request again if needed." : "Retrieval failed — our team has been notified."}
        </p>
      )}
    </div>
  );
}
