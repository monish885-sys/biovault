import { useCallback, useEffect, useState, type FormEvent } from "react";
import { erasureApi, type ErasureRequest } from "../lib/api";

export function CompliancePanel() {
  const [requests, setRequests] = useState<ErasureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [reason, setReason] = useState("DPDPA Right to Erasure request");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { requests: list } = await erasureApi.list();
      setRequests(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load erasure requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await erasureApi.create({ subjectId, reason, searchQuery });
      setSubjectId("");
      setSearchQuery("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4 md:grid-cols-2"
      >
        <div>
          <label className="mb-1 block text-xs text-slate-400">Subject ID</label>
          <input
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            placeholder="SUBJ-2024-0042"
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">File search query</label>
          <input
            required
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="patient filename or keyword"
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-slate-400">Reason</label>
          <input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="md:col-span-2 rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit erasure request"}
        </button>
      </form>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Files</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No erasure requests yet.
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="border-b border-slate-800">
                  <td className="px-4 py-3 font-medium">{req.subjectId}</td>
                  <td className="px-4 py-3 text-slate-400">{req.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-slate-400">{req.matchedFileCount}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(req.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {req.status === "completed" && req.certificateId && (
                      <a
                        href={erasureApi.certificateDownloadUrl(req.id)}
                        className="text-xs text-emerald-400 hover:underline"
                      >
                        Download certificate
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
