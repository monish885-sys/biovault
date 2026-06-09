import { useState, type FormEvent } from "react";
import { searchApi, retrievalApi, type FileSearchResult } from "../lib/api";

type Props = {
  onJobCreated: () => void;
};

export function SearchPanel({ onJobCreated }: Props) {
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

  async function runSearch(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const params: Record<string, string> = { limit: "50" };
      if (q.trim()) params.q = q.trim();
      if (category.trim()) params.category = category.trim();
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
      setMessage("Retrieval requested — track progress in the Jobs tab.");
      onJobCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRequesting(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={runSearch} className="grid gap-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4 md:grid-cols-3">
        <input
          placeholder="Filename or keyword"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <input
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <input
          placeholder="File type (e.g. dcm)"
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search archive"}
        </button>
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
        {total} file{total === 1 ? "" : "s"} found — tape locations are never shown.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Filename</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Ingested</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {loading ? "Loading…" : "No results — run a search to find archived files."}
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr key={file.id} className="border-b border-slate-800 hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-medium">{file.filename}</td>
                  <td className="px-4 py-3 text-slate-400">{file.fileType}</td>
                  <td className="px-4 py-3 text-slate-400">{file.category}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(file.ingestedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => requestFile(file.id)}
                      disabled={requesting === file.id}
                      className="rounded border border-emerald-600/50 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-600/20 disabled:opacity-50"
                    >
                      {requesting === file.id ? "Requesting…" : "Request file"}
                    </button>
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
