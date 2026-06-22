import { useCallback, useEffect, useState } from "react";
import { clientApi, type ClientProfile } from "../lib/api";
import { TIER_LABELS } from "../lib/labels";
import { CategoryBarChart } from "./diagrams/CategoryBarChart";
import { TapeShelfVisual } from "./diagrams/TapeShelfVisual";
import { VaultDiagram } from "./diagrams/VaultDiagram";

type Props = {
  onNavigate: (tab: "search" | "jobs" | "billing" | "compliance") => void;
  showBillingLink?: boolean;
};

export function DashboardPanel({ onNavigate, showBillingLink = false }: Props) {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { client } = await clientApi.me();
      setProfile(client);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <span className="animate-pulse">Loading your vault overview…</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        {error ?? "Unable to load dashboard"}
      </p>
    );
  }

  const { vault } = profile;

  return (
    <div className="space-y-6">
      {/* Welcome hero */}
      <div className="vault-card relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">
            Secure medical archive
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white md:text-3xl">{profile.name}</h2>
          <p className="mt-2 max-w-xl text-slate-400">
            Your patient imaging, lab reports, and clinical records are safely stored on offline
            tapes. Use this portal to find files and request copies — no IT expertise required.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-600 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">
              {TIER_LABELS[profile.tier] ?? profile.tier} plan
            </span>
            <span className="rounded-full border border-slate-600 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">
              {profile.retentionPolicyYears}-year retention
            </span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            tab: "search" as const,
            icon: "🔍",
            title: "Find a record",
            desc: "Search by patient name, scan type, or date",
          },
          {
            tab: "jobs" as const,
            icon: "📬",
            title: "Track requests",
            desc: "See status of files you've asked for",
          },
          ...(showBillingLink
            ? [
                {
                  tab: "billing" as const,
                  icon: "📊",
                  title: "Usage & billing",
                  desc: "Storage used and monthly estimate",
                },
              ]
            : []),
          {
            tab: "compliance" as const,
            icon: "🛡️",
            title: "Compliance",
            desc: "Erasure requests and audit exports",
          },
        ].map((action) => (
          <button
            key={action.tab}
            type="button"
            onClick={() => onNavigate(action.tab)}
            className="vault-card group flex flex-col items-start p-4 text-left transition hover:border-emerald-500/40 hover:bg-emerald-950/20"
          >
            <span className="text-2xl transition group-hover:scale-110">{action.icon}</span>
            <p className="mt-2 font-medium text-slate-100">{action.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{action.desc}</p>
          </button>
        ))}
      </div>

      {/* Storage tapes — hero visual */}
      <TapeShelfVisual usedTb={vault.storageTb} capacityTb={vault.storageIncludedTb} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="vault-card p-5">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Storage by record type</h3>
          <CategoryBarChart rows={vault.byCategory} maxTb={vault.storageIncludedTb} />
        </div>
        <VaultDiagram />
      </div>
    </div>
  );
}
