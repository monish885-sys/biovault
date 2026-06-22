import { useCallback, useEffect, useState, type FormEvent } from "react";
import { auditApi, erasureApi, type ErasureRequest } from "../lib/api";

type Props = {
  canSubmit?: boolean;
};

export function CompliancePanel({ canSubmit = true }: Props) {
  const [requests, setRequests] = useState<ErasureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [reason, setReason] = useState("DPDPA Right to Erasure request");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  async function exportAudit() {
    setExporting(true);
    setError(null);
    try {
      const data = await auditApi.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sentinel-audit-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="vault-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl">🛡️</span>
          <div>
            <p className="font-medium text-slate-200">Privacy & compliance</p>
            <p className="text-sm text-slate-400">
              Submit data erasure requests under DPDPA or export your audit trail for regulators.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void exportAudit()}
          disabled={exporting}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export audit trail"}
        </button>
      </div>

      {canSubmit && (
        <form onSubmit={handleSubmit} className="vault-card grid gap-4 p-5 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Patient / subject ID</label>
            <input
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder="SUBJ-2024-0042"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">File search query</label>
            <input
              required
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="patient filename or keyword"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-slate-500">Reason for erasure</label>
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="md:col-span-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit erasure request"}
          </button>
        </form>
      )}

      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : requests.length === 0 ? (
          <div className="vault-card py-10 text-center text-slate-500">No erasure requests yet.</div>
        ) : (
          requests.map((req) => (
            <article key={req.id} className="vault-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-slate-200">{req.subjectId}</p>
                <p className="text-sm text-slate-500">
                  {req.status.replace(/_/g, " ")} · {req.matchedFileCount} file
                  {req.matchedFileCount === 1 ? "" : "s"} ·{" "}
                  {new Date(req.createdAt).toLocaleDateString()}
                </p>
              </div>
              {req.status === "completed" && req.certificateId && (
                <a
                  href={erasureApi.certificateDownloadUrl(req.id)}
                  className="rounded-lg border border-emerald-600/40 px-3 py-1.5 text-sm text-emerald-400 hover:bg-emerald-600/10"
                >
                  Download certificate
                </a>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
