import { useCallback, useEffect, useState } from "react";
import { erasureApi, type AdminErasureRequest } from "../lib/api";

export function ErasureQueue() {
  const [requests, setRequests] = useState<AdminErasureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminErasureRequest | null>(null);

  const load = useCallback(async () => {
    try {
      const { requests: list } = await erasureApi.list();
      setRequests(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load erasure queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(poll);
  }, [load]);

  async function showDetail(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    try {
      const { request } = await erasureApi.get(id);
      setDetail(request);
      setExpandedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load detail");
    }
  }

  async function complete(id: string) {
    setActionId(id);
    setError(null);
    try {
      await erasureApi.complete(id, { degaussMethod: "degauss" });
      setExpandedId(null);
      setDetail(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Complete failed");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">DPDPA erasure requests awaiting tape degauss</p>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && requests.length === 0 ? (
        <p className="text-zinc-400">Loading erasure queue…</p>
      ) : requests.length === 0 ? (
        <p className="text-zinc-400">No pending erasure requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <article
              key={req.id}
              className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{req.subjectId}</p>
                  <p className="text-sm text-zinc-400">
                    {req.matchedFileCount} file(s) · {req.status.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-zinc-500">Query: {req.searchQuery}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void showDetail(req.id)}
                    className="rounded border border-zinc-600 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    {expandedId === req.id ? "Hide" : "Details"}
                  </button>
                  {req.status === "awaiting_degauss" && req.matchedFileCount > 0 && (
                    <button
                      type="button"
                      disabled={actionId === req.id}
                      onClick={() => void complete(req.id)}
                      className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {actionId === req.id ? "Completing…" : "Confirm degauss"}
                    </button>
                  )}
                </div>
              </div>

              {expandedId === req.id && detail && (
                <div className="mt-4 border-t border-zinc-700 pt-4 text-sm">
                  <p className="mb-2 text-zinc-400">Affected tapes (load for degauss):</p>
                  <ul className="mb-3 space-y-1">
                    {(detail.tapeLocations ?? []).map((t) => (
                      <li key={t.barcode} className="font-mono text-amber-300">
                        {t.barcode} · rack {t.rack} · slot {t.slot}
                      </li>
                    ))}
                  </ul>
                  <p className="mb-1 text-zinc-400">Files to erase:</p>
                  <ul className="list-inside list-disc text-zinc-300">
                    {(detail.filenames ?? []).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
