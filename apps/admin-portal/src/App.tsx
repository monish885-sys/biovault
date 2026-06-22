import { useCallback, useEffect, useState } from "react";
import { ErasureQueue } from "./components/ErasureQueue";
import { JobQueue } from "./components/JobQueue";
import { LoginForm } from "./components/LoginForm";
import { DemoBanner } from "./components/DemoBanner";
import { TapeInventory } from "./components/TapeInventory";
import { authApi, type AuthUser } from "./lib/api";

type Tab = "jobs" | "tapes" | "erasure";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("jobs");

  const refreshSession = useCallback(async () => {
    try {
      const { user: me } = await authApi.me();
      const internal = me.role === "ops_admin" || me.role === "technician";
      setUser(internal ? me : null);
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
    try {
      await authApi.logout();
    } catch {
      // Clear local session even if cookie already expired
    }
    setUser(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        {DEMO_MODE && <DemoBanner portal="admin" />}
        <div className="p-8">
        <header className="mb-10 text-center">
          <p className="text-sm uppercase tracking-widest text-amber-400">Operations</p>
          <h1 className="mt-2 text-3xl font-semibold">Sentinel Admin Portal</h1>
          <p className="mt-2 text-zinc-400">Sign in to manage retrieval jobs and tape inventory.</p>
        </header>
        <LoginForm onLogin={handleLogin} error={loginError ?? undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {DEMO_MODE && <DemoBanner portal="admin" />}
      <div className="p-6 md:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-700 pb-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-amber-400">Operations</p>
          <h1 className="text-2xl font-semibold">Sentinel Admin Portal</h1>
          <p className="text-sm text-zinc-400">
            {user.email} · {user.role.replace(/_/g, " ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Sign out
        </button>
      </header>

      <nav className="mb-6 flex gap-2">
        {(
          [
            ["jobs", "Retrieval queue"],
            ["tapes", "Tape inventory"],
            ["erasure", "Erasure queue"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === id
                ? "bg-amber-600 text-white"
                : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "jobs" ? <JobQueue /> : tab === "tapes" ? <TapeInventory /> : <ErasureQueue />}
      </div>
    </div>
  );
}
