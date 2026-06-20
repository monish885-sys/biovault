import { useCallback, useEffect, useState } from "react";
import { billingApi, type BillingSummary } from "../lib/api";

export function BillingPanel() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { summary: s } = await billingApi.summary();
      setSummary(s);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-slate-400">Loading billing…</p>;
  if (error) {
    return (
      <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        {error}
      </p>
    );
  }
  if (!summary) return null;

  const fmtInr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-400">Storage used</p>
          <p className="mt-1 text-2xl font-semibold">{summary.storageTb} TB</p>
          <p className="text-xs text-slate-500">
            {summary.storageIncludedTb} TB included ({summary.tier} tier)
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-400">Retrievals this month</p>
          <p className="mt-1 text-2xl font-semibold">
            {summary.retrievalsUsed} / {summary.retrievalsIncluded}
          </p>
          {summary.retrievalsOverage > 0 && (
            <p className="text-xs text-amber-400">{summary.retrievalsOverage} over bundle</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-400">Estimated monthly</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {fmtInr(summary.estimatedMonthlyInr)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 p-4">
        <p className="font-medium text-emerald-300">Savings vs cloud cold storage</p>
        <p className="mt-1 text-sm text-slate-300">
          Glacier Deep Archive estimate: {fmtInr(summary.cloudComparisonInr)}/mo — you save{" "}
          <span className="font-semibold text-emerald-400">
            {fmtInr(summary.savingsVsCloudInr)}
          </span>
          /mo with BioVault Sentinel
        </p>
      </div>

      {summary.byCategory.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Storage (TB)</th>
              </tr>
            </thead>
            <tbody>
              {summary.byCategory.map((row) => (
                <tr key={row.category} className="border-b border-slate-800">
                  <td className="px-4 py-3">{row.category}</td>
                  <td className="px-4 py-3 text-slate-400">{row.tb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
