import { useState, type FormEvent } from "react";
import { searchApi, retrievalApi, type FileSearchResult } from "../lib/api";
import { friendlyCategory } from "../lib/labels";

const QUICK_CATEGORIES = [
  { value: "imaging", label: "Medical imaging", icon: "🩻" },
  { value: "lab_reports", label: "Lab reports", icon: "🧪" },
  { value: "clinical", label: "Clinical records", icon: "📋" },
];

type Props = {
  canRequest?: boolean;
  onJobCreated: () => void;
};

export function SearchPanel({ canRequest = true, onJobCreated }: Props) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [fileType, setFileType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [files, setFiles] = useState<FileSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e?: FormEvent, categoryOverride?: string) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const activeCategory = categoryOverride ?? category;
    if (categoryOverride !== undefined) setCategory(categoryOverride);
    try {
      const params: Record<string, string> = { limit: "50" };
      if (q.trim()) params.q = q.trim();
      if (activeCategory.trim()) params.category = activeCategory.trim();
      if (fileType.trim()) params.fileType = fileType.trim();
      if (from) params.from = from;
      if (to) params.to = to;
      const result = await searchApi.files(params);
      setFiles(result.files);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function requestFile(fileId: string) {
    setRequesting(fileId);
    setError(null);
    setMessage(null);
    try {
      await retrievalApi.create(fileId);
      setMessage("Request sent! Track progress under Retrieval jobs — your file will be ready within 15 minutes.");
      onJobCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRequesting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="vault-card p-5">
        <h2 className="text-lg font-semibold text-slate-100">Find archived records</h2>
        <p className="mt-1 text-sm text-slate-400">
          Search your hospital&apos;s offline archive by patient name, scan type, or date. When you
          find what you need, click <strong className="text-emerald-400">Request file</strong> and
          we&apos;ll retrieve it from tape for you.
        </p>
      </div>

      {/* Quick category chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => void runSearch(undefined, cat.value)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              category === cat.value
                ? "border-emerald-500 bg-emerald-600/20 text-emerald-300"
                : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={runSearch}
        className="vault-card grid gap-4 p-4 md:grid-cols-3"
      >
        <div>
          <label className="mb-1 block text-xs text-slate-500">Patient name or keyword</label>
          <input
            placeholder="Filename or keyword"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Record category</label>
          <input
            placeholder="imaging, lab_reports, clinical"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">File type</label>
          <input
            placeholder="e.g. dcm for DICOM scans"
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">From date</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">To date</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search archive"}
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <p className="text-sm text-slate-400">
        {total} record{total === 1 ? "" : "s"} found — your files are stored securely on offline tapes.
      </p>

      <div className="space-y-3">
        {files.length === 0 ? (
          <div className="vault-card py-12 text-center">
            <span className="text-4xl">📂</span>
            <p className="mt-3 text-slate-500">
              {loading ? "Searching…" : "No results yet — try a search above or pick a category."}
            </p>
          </div>
        ) : (
          files.map((file) => (
            <article
              key={file.id}
              className="vault-card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-slate-600"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-lg">
                  {file.fileType === "dcm" ? "🩻" : file.fileType === "pdf" ? "📄" : "📁"}
                </span>
                <div>
                  <h3 className="font-medium text-slate-100">{file.filename}</h3>
                  <p className="text-sm text-slate-500">
                    {friendlyCategory(file.category)} · {file.fileType.toUpperCase()} ·{" "}
                    {new Date(file.ingestedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {canRequest ? (
                <button
                  type="button"
                  onClick={() => requestFile(file.id)}
                  disabled={requesting === file.id}
                  className="rounded-lg border border-emerald-600/50 bg-emerald-600/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-600/20 disabled:opacity-50"
                >
                  {requesting === file.id ? "Requesting…" : "Request file"}
                </button>
              ) : (
                <span className="text-xs text-slate-500">View only</span>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
