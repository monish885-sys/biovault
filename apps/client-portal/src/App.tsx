import { useCallback, useEffect, useState } from "react";
import { LoginForm } from "./components/LoginForm";
import { RetrievalTracker } from "./components/RetrievalTracker";
import { SearchPanel } from "./components/SearchPanel";
import { authApi, type AuthUser } from "./lib/api";

type Tab = "search" | "jobs";

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("search");
  const [jobsKey, setJobsKey] = useState(0);

  const refreshSession = useCallback(async () => {
    try {
      const { user: me } = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
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
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
      throw err;
    }
  }

  async function handleLogout() {
    await authApi.logout();
    setUser(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen p-8">
        <header className="mb-10 text-center">
          <p className="text-sm uppercase tracking-widest text-emerald-400">BioVault Sentinel</p>
          <h1 className="mt-2 text-3xl font-semibold">Client Portal</h1>
          <p className="mt-2 text-slate-400">Sign in to search archives and request retrievals.</p>
        </header>
        <LoginForm onLogin={handleLogin} error={loginError ?? undefined} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-emerald-400">BioVault Sentinel</p>
          <h1 className="text-2xl font-semibold">Client Portal</h1>
          <p className="text-sm text-slate-400">
            {user.email} · {user.role.replace(/_/g, " ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Sign out
        </button>
      </header>

      <nav className="mb-6 flex gap-2">
        {(
          [
            ["search", "Search archive"],
            ["jobs", "Retrieval jobs"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === id
                ? "bg-emerald-600 text-white"
                : "border border-slate-700 text-slate-300 hover:bg-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "search" ? (
        <SearchPanel onJobCreated={() => setJobsKey((k) => k + 1)} />
      ) : (
        <RetrievalTracker key={jobsKey} />
      )}
    </div>
  );
}
