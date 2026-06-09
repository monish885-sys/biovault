import { useCallback, useEffect, useState } from "react";
import { tapesApi, type AdminTape } from "../lib/api";

function healthClass(score: string): string {
  switch (score) {
    case "green":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "amber":
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    case "red":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    default:
      return "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";
  }
}

export function TapeInventory() {
  const [tapes, setTapes] = useState<AdminTape[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await tapesApi.list();
      setTapes(result.tapes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tapes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-zinc-400">Loading tape inventory…</p>;

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-zinc-700">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-700 bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Barcode</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Fill</th>
              <th className="px-4 py-3 font-medium">Health</th>
              <th className="px-4 py-3 font-medium">Cycles</th>
              <th className="px-4 py-3 font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {tapes.map((tape) => (
              <tr key={tape.barcode} className="border-b border-zinc-800 hover:bg-zinc-900/40">
                <td className="px-4 py-3 font-mono">{tape.barcode}</td>
                <td className="px-4 py-3 text-zinc-400">
                  {tape.rack} / {tape.slot}
                </td>
                <td className="px-4 py-3 text-zinc-400">{tape.status}</td>
                <td className="px-4 py-3">{tape.fillPercent.toFixed(1)}%</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded border px-2 py-0.5 text-xs uppercase ${healthClass(tape.healthScore)}`}
                  >
                    {tape.healthScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400">{tape.writeCycles}</td>
                <td className="px-4 py-3 text-zinc-400">{tape.ageDays}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
