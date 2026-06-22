import { useCallback, useEffect, useRef, useState } from "react";
import { jobsApi, type AdminJob } from "../lib/api";
import { SlaTimer } from "./SlaTimer";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  ready: "Ready for client",
  delivered: "Delivered",
  expired: "Expired",
  failed: "Failed",
};

function healthForJob(job: AdminJob): string {
  if (job.slaOverdue) return "border-red-500/50";
  if (job.status === "ready") return "border-emerald-500/50";
  return "border-zinc-700";
}

export function JobQueue() {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionJobId, setActionJobId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const fetchedAt = useRef(Date.now());
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await jobsApi.list(showOverdueOnly ? { overdue: true } : undefined);
      setJobs(result.jobs);
      fetchedAt.current = Date.now();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [showOverdueOnly]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsedSinceFetch = Math.floor((now - fetchedAt.current) / 1000);

  async function runAction(jobId: string, action: "assign" | "start" | "complete") {
    setActionJobId(jobId);
    setError(null);
    try {
      if (action === "assign") await jobsApi.assign(jobId);
      else if (action === "start") await jobsApi.start(jobId);
      else await jobsApi.complete(jobId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionJobId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Live retrieval queue with 15-minute SLA — ops never download client file bytes
        </p>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={showOverdueOnly}
            onChange={(e) => setShowOverdueOnly(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Overdue only
        </label>
      </div>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && jobs.length === 0 ? (
        <p className="text-zinc-400">Loading job queue…</p>
      ) : jobs.length === 0 ? (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-8 text-center text-zinc-500">
          No jobs in queue{showOverdueOnly ? " matching overdue filter" : ""}.
        </p>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const slaSeconds = job.slaRemainingSeconds - elapsedSinceFetch;
            const overdue = slaSeconds < 0;
            const busy = actionJobId === job.id;

            return (
              <article
                key={job.id}
                className={`rounded-lg border bg-zinc-900/50 p-4 ${healthForJob({ ...job, slaOverdue: overdue })}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{job.filename}</h3>
                    <p className="text-sm text-zinc-400">
                      {job.clientName} · {job.fileType} · {job.category}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Requested by {job.requestedBy}
                      {job.assignedTo ? ` · Assigned to ${job.assignedTo}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <SlaTimer remainingSeconds={slaSeconds} overdue={overdue} />
                    <p className="mt-1 text-xs text-zinc-500">
                      {STATUS_LABELS[job.status] ?? job.status}
                    </p>
                  </div>
                </div>

                {job.tape && (
                  <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-sm">
                    <span className="text-amber-400">TAPE</span> {job.tape.tapeBarcode}
                    <span className="mx-2 text-zinc-600">|</span>
                    Rack {job.tape.rack}
                    <span className="mx-2 text-zinc-600">|</span>
                    Slot {job.tape.slot}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {job.status === "pending" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(job.id, "assign")}
                      className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium hover:bg-amber-500 disabled:opacity-50"
                    >
                      Assign to me
                    </button>
                  )}
                  {job.status === "assigned" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(job.id, "start")}
                      className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium hover:bg-amber-500 disabled:opacity-50"
                    >
                      Start retrieval
                    </button>
                  )}
                  {job.status === "in_progress" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(job.id, "complete")}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Complete & stage for client
                    </button>
                  )}
                  {job.status === "ready" && (
                    <p className="rounded border border-emerald-600/40 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-300">
                      Staged on vault — awaiting client download in their portal
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
