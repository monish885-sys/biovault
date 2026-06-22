import { useCallback, useEffect, useState } from "react";
import { BillingPanel } from "./components/BillingPanel";
import { CompliancePanel } from "./components/CompliancePanel";
import { DashboardPanel } from "./components/DashboardPanel";
import { LoginForm } from "./components/LoginForm";
import { RetrievalTracker } from "./components/RetrievalTracker";
import { SearchPanel } from "./components/SearchPanel";
import { authApi, clientApi, type AuthUser, type ClientProfile } from "./lib/api";

type Tab = "overview" | "search" | "jobs" | "billing" | "compliance";

const TAB_META: Record<Tab, { label: string; icon: string; hint: string }> = {
  overview: { label: "Overview", icon: "🏠", hint: "Vault & storage at a glance" },
  search: { label: "Search archive", icon: "🔍", hint: "Find patient records" },
  jobs: { label: "Retrieval jobs", icon: "📬", hint: "Track your file requests" },
  billing: { label: "Billing", icon: "📊", hint: "Usage and costs" },
  compliance: { label: "Compliance", icon: "🛡️", hint: "Privacy & audit" },
};

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [jobsKey, setJobsKey] = useState(0);

  const refreshSession = useCallback(async () => {
    try {
      const { user: me } = await authApi.me();
      const clientRole =
        me.role === "client_admin" ||
        me.role === "client_viewer" ||
        me.role === "compliance_officer";
      if (clientRole) {
        setUser(me);
        try {
          const { client: profile } = await clientApi.me();
          setClient(profile);
        } catch {
          setClient(null);
        }
      } else {
        setUser(null);
        setClient(null);
      }
    } catch {
      setUser(null);
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  async function handleLogin(email: string, password: string) {
    setLoginError(null);
    try {
      const { user: loggedIn } = await authApi.login(email, password);
      setUser(loggedIn);
      try {
        const { client: profile } = await clientApi.me();
        setClient(profile);
      } catch {
        setClient(null);
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
      throw err;
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Clear local session even if cookie already expired
    }
    setUser(null);
    setClient(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-slate-400">Loading portal…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-mesh p-8">
        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-3xl ring-1 ring-emerald-500/30">
            🏥
          </div>
          <p className="text-sm uppercase tracking-widest text-emerald-400">BioVault Sentinel</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Hospital Archive Portal</h1>
          <p className="mx-auto mt-2 max-w-md text-slate-400">
            Secure access to your offline medical records — search, request, and download with ease.
          </p>
        </header>
        <LoginForm onLogin={handleLogin} error={loginError ?? undefined} />
      </div>
    );
  }

  const isAdmin = user.role === "client_admin";
  const canRequest = user.role === "client_admin" || user.role === "compliance_officer";
  const canErasure = canRequest;

  const tabs = [
    "overview",
    "search",
    "jobs",
    ...(isAdmin ? (["billing"] as const) : []),
    ...(canErasure ? (["compliance"] as const) : []),
  ] as Tab[];

  const activeTab = tabs.includes(tab) ? tab : tabs[0]!;

  return (
    <div className="min-h-screen bg-mesh">
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl ring-1 ring-emerald-500/25">
              🏥
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-400">BioVault Sentinel</p>
              <h1 className="text-xl font-bold text-white md:text-2xl">
                {client?.name ?? "Client Portal"}
              </h1>
              <p className="text-sm text-slate-500">
                Client Portal · {user.email} · {user.role.replace(/_/g, " ")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:bg-slate-800/60"
          >
            Sign out
          </button>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2">
          {tabs.map((id) => {
            const meta = TAB_META[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                title={meta.hint}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === id
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
                    : "border border-slate-700/80 bg-slate-900/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60"
                }`}
              >
                <span aria-hidden>{meta.icon}</span>
                {meta.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "overview" ? (
          <DashboardPanel
            onNavigate={setTab}
            showBillingLink={isAdmin}
          />
        ) : activeTab === "search" ? (
          <SearchPanel canRequest={canRequest} onJobCreated={() => setJobsKey((k) => k + 1)} />
        ) : activeTab === "jobs" ? (
          <RetrievalTracker key={jobsKey} />
        ) : activeTab === "billing" ? (
          <BillingPanel />
        ) : (
          <CompliancePanel canSubmit={canErasure} />
        )}
      </div>
    </div>
  );
}
