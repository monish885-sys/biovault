import { useCallback, useEffect, useRef, useState } from "react";
import { retrievalApi, type RetrievalJob } from "../lib/api";
import { friendlyCategory } from "../lib/labels";
import { RetrievalProgressSteps } from "./diagrams/RetrievalProgressSteps";
import { SlaBadge } from "./SlaBadge";

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for our team",
  assigned: "A technician is on it",
  in_progress: "Pulling from tape vault",
  ready: "Ready — download now",
  delivered: "Downloaded successfully",
  expired: "Download link expired",
  failed: "Something went wrong",
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

type Props = {
  canDownload?: boolean;
};

export function RetrievalTracker({ canDownload = true }: Props) {
  const [jobs, setJobs] = useState<RetrievalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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

  async function downloadJob(job: RetrievalJob) {
    if (!job.downloadUrl) return;
    setDownloadingId(job.id);
    setError(null);
    try {
      await retrievalApi.download(job.downloadUrl, job.filename);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="vault-card p-5">
        <h2 className="text-lg font-semibold text-slate-100">Your file requests</h2>
        <p className="mt-1 text-sm text-slate-400">
          When you request a record, our team retrieves it from the offline tape vault. Most requests
          are ready within <strong className="text-emerald-400">15 minutes</strong>.
        </p>
      </div>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && jobs.length === 0 ? (
        <p className="text-slate-400">Loading retrieval jobs…</p>
      ) : jobs.length === 0 ? (
        <div className="vault-card py-12 text-center">
          <span className="text-4xl">📬</span>
          <p className="mt-3 text-slate-500">No requests yet.</p>
          <p className="mt-1 text-sm text-slate-600">
            Search for a record and click &quot;Request file&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const slaSeconds = job.slaRemainingSeconds - elapsedSinceFetch;
            const overdue = slaSeconds < 0;

            return (
              <article key={job.id} className="vault-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xl">
                      {job.fileType === "dcm" ? "🩻" : "📄"}
                    </span>
                    <div>
                      <h3 className="font-medium text-slate-100">{job.filename}</h3>
                      <p className="text-sm text-slate-500">
                        {friendlyCategory(job.category)} · {job.fileType.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <SlaBadge remainingSeconds={slaSeconds} overdue={overdue} />
                </div>

                <RetrievalProgressSteps status={job.status} />

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <span className={`font-medium ${statusTone(job.status)}`}>
                    {STATUS_LABELS[job.status] ?? job.status}
                  </span>
                  <span className="text-slate-500">
                    Due by {new Date(job.dueAt).toLocaleTimeString()}
                  </span>
                </div>

                {job.status === "ready" && job.downloadUrl && canDownload && (
                  <button
                    type="button"
                    disabled={downloadingId === job.id}
                    onClick={() => void downloadJob(job)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {downloadingId === job.id ? "Downloading…" : "📥 Download file"}
                    {job.downloadExpiresAt && (
                      <span className="text-emerald-200/80">
                        (expires {new Date(job.downloadExpiresAt).toLocaleTimeString()})
                      </span>
                    )}
                  </button>
                )}
                {job.status === "ready" && !canDownload && (
                  <p className="mt-3 text-sm text-slate-500">
                    Ready — contact your administrator to download.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
