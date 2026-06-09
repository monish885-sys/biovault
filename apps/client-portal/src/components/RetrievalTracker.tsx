import { useCallback, useEffect, useRef, useState } from "react";
import { absoluteDownloadUrl, retrievalApi, type RetrievalJob } from "../lib/api";
import { SlaBadge } from "./SlaBadge";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending assignment",
  assigned: "Assigned to technician",
  in_progress: "Retrieval in progress",
  ready: "Ready for download",
  delivered: "Delivered",
  expired: "Download expired",
  failed: "Failed",
};

function statusTone(status: string): string {
  switch (status) {
    case "ready":
      return "text-emerald-300";
    case "failed":
    case "expired":
      return "text-red-300";
    case "in_progress":
    case "assigned":
      return "text-amber-300";
    default:
      return "text-slate-300";
  }
}

export function RetrievalTracker() {
  const [jobs, setJobs] = useState<RetrievalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const fetchedAt = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const result = await retrievalApi.list();
      setJobs(result.jobs);
      fetchedAt.current = Date.now();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && jobs.length === 0 ? (
        <p className="text-slate-400">Loading retrieval jobs…</p>
      ) : jobs.length === 0 ? (
        <p className="rounded-lg border border-slate-700 bg-slate-900/50 p-8 text-center text-slate-500">
          No retrieval requests yet. Search for a file and click Request file.
        </p>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const slaSeconds = job.slaRemainingSeconds - elapsedSinceFetch;
            const overdue = slaSeconds < 0;

            return (
              <article
                key={job.id}
                className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{job.filename}</h3>
                    <p className="text-sm text-slate-400">
                      {job.fileType} · {job.category}
                    </p>
                  </div>
                  <SlaBadge remainingSeconds={slaSeconds} overdue={overdue} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <span className={statusTone(job.status)}>
                    {STATUS_LABELS[job.status] ?? job.status}
                  </span>
                  <span className="text-slate-500">
                    Due {new Date(job.dueAt).toLocaleTimeString()}
                  </span>
                </div>
                {job.status === "ready" && job.downloadUrl && (
                  <a
                    href={absoluteDownloadUrl(job.downloadUrl)}
                    className="mt-3 inline-flex rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                    download
                  >
                    Download file
                    {job.downloadExpiresAt && (
                      <span className="ml-2 text-emerald-200/80">
                        (expires {new Date(job.downloadExpiresAt).toLocaleTimeString()})
                      </span>
                    )}
                  </a>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
