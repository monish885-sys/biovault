import { useCallback, useEffect, useState } from "react";
import { billingApi, type BillingSummary, type InvoicePreview } from "../lib/api";
import { friendlyCategory, TIER_LABELS } from "../lib/labels";
import { CategoryBarChart } from "./diagrams/CategoryBarChart";
import { LtoTapeCartridge } from "./diagrams/LtoTapeCartridge";
import { TapeShelfVisual } from "./diagrams/TapeShelfVisual";
import { overallFillPercent } from "../lib/storage-math";

export function BillingPanel() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ summary: s }, { invoice: inv }] = await Promise.all([
        billingApi.summary(),
        billingApi.invoice(),
      ]);
      setSummary(s);
      setInvoice(inv);
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
  const fillPct = overallFillPercent(summary.storageTb, summary.storageIncludedTb);
  const remainingTb = Math.max(
    0,
    Math.round((summary.storageIncludedTb - summary.storageTb) * 1000) / 1000,
  );
  const retrievalPct = Math.min(
    100,
    Math.round((summary.retrievalsUsed / summary.retrievalsIncluded) * 100),
  );

  return (
    <div className="space-y-6">
      <div className="vault-card p-5">
        <h2 className="text-lg font-semibold text-slate-100">Usage & billing overview</h2>
        <p className="mt-1 text-sm text-slate-400">
          {TIER_LABELS[summary.tier] ?? summary.tier} plan — visual summary of your archive usage.
        </p>
      </div>

      {/* Hero tape + stats */}
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="vault-card flex flex-col items-center justify-center p-6">
          <p className="mb-3 text-sm font-medium text-slate-300">Overall vault fill</p>
          <LtoTapeCartridge
            fillPercent={fillPct}
            size="lg"
            highlight
            label={`${summary.storageTb} TB stored`}
            sublabel={`${remainingTb} TB free`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="vault-card p-4">
            <p className="text-sm text-slate-400">Storage used</p>
            <p className="mt-1 text-3xl font-bold text-white">{summary.storageTb} TB</p>
            <p className="text-xs text-slate-500">
              {summary.storageIncludedTb} TB included in plan
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
          <div className="vault-card p-4">
            <p className="text-sm text-slate-400">Retrievals this month</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {summary.retrievalsUsed}{" "}
              <span className="text-lg font-normal text-slate-500">
                / {summary.retrievalsIncluded}
              </span>
            </p>
            {summary.retrievalsOverage > 0 && (
              <p className="text-xs text-amber-400">{summary.retrievalsOverage} over bundle</p>
            )}
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${retrievalPct >= 100 ? "bg-amber-500" : "bg-blue-500"}`}
                style={{ width: `${Math.min(100, retrievalPct)}%` }}
              />
            </div>
          </div>
          <div className="vault-card p-4 sm:col-span-2">
            <p className="text-sm text-slate-400">Estimated monthly cost</p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">
              {fmtInr(summary.estimatedMonthlyInr)}
            </p>
          </div>
        </div>
      </div>

      <TapeShelfVisual usedTb={summary.storageTb} capacityTb={summary.storageIncludedTb} compact />

      <div className="rounded-xl border border-emerald-700/40 bg-gradient-to-r from-emerald-950/40 to-slate-900/40 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-3xl">💰</span>
          <div>
            <p className="font-medium text-emerald-300">Savings vs cloud cold storage</p>
            <p className="mt-1 text-sm text-slate-300">
              Glacier Deep Archive estimate: {fmtInr(summary.cloudComparisonInr)}/mo — you save{" "}
              <span className="font-semibold text-emerald-400">
                {fmtInr(summary.savingsVsCloudInr)}
              </span>
              /mo with BioVault Sentinel
            </p>
          </div>
        </div>
      </div>

      {summary.byCategory.length > 0 && (
        <div className="vault-card p-5">
          <h3 className="mb-4 font-medium text-slate-200">Storage by record type</h3>
          <CategoryBarChart rows={summary.byCategory} maxTb={summary.storageIncludedTb} />
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
              View detailed table
            </summary>
            <table className="mt-3 min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 font-medium">Storage (TB)</th>
                </tr>
              </thead>
              <tbody>
                {summary.byCategory.map((row) => (
                  <tr key={row.category} className="border-b border-slate-800">
                    <td className="py-2 pr-4">{friendlyCategory(row.category)}</td>
                    <td className="py-2 text-slate-400">{row.tb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}

      {invoice && (
        <div className="vault-card p-5">
          <p className="font-medium text-slate-200">Invoice preview — {invoice.period}</p>
          <table className="mt-3 min-w-full text-left text-sm">
            <thead className="border-b border-slate-700 text-slate-400">
              <tr>
                <th className="py-2 pr-4 font-medium">Item</th>
                <th className="py-2 pr-4 font-medium">Qty</th>
                <th className="py-2 pr-4 font-medium">Unit</th>
                <th className="py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr key={item.label} className="border-b border-slate-800">
                  <td className="py-2 pr-4">{item.label}</td>
                  <td className="py-2 pr-4 text-slate-400">{item.quantity}</td>
                  <td className="py-2 pr-4 text-slate-400">{fmtInr(item.unitInr)}</td>
                  <td className="py-2 text-right text-slate-300">{fmtInr(item.totalInr)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 text-right font-medium text-slate-300">
                  Estimated total
                </td>
                <td className="pt-3 text-right font-semibold text-emerald-400">
                  {fmtInr(invoice.estimatedTotalInr)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
