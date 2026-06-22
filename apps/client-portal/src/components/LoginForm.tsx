import { useState, type FormEvent } from "react";

type Props = {
  onLogin: (email: string, password: string) => Promise<void>;
  error?: string;
};

export function LoginForm({ onLogin, error }: Props) {
  const [email, setEmail] = useState("admin@acme.test");
  const [password, setPassword] = useState("ChangeMe123!");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(email, password);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="vault-card mb-6 p-5">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl">🏥</span>
            <span className="text-[10px]">Hospital</span>
          </div>
          <div className="h-px flex-1 bg-slate-700" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl">🔍</span>
            <span className="text-[10px]">Search</span>
          </div>
          <div className="h-px flex-1 bg-slate-700" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl">📼</span>
            <span className="text-[10px]">Vault</span>
          </div>
          <div className="h-px flex-1 bg-slate-700" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl">📥</span>
            <span className="text-[10px]">Download</span>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Sign in to search your archive and request patient records
        </p>
      </div>

      <form onSubmit={handleSubmit} className="vault-card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm text-slate-400" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-emerald-500"
            required
            autoComplete="username"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-emerald-500"
            required
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-xs text-slate-500">
          Demo: admin@acme.test / ChangeMe123!
        </p>
      </form>
    </div>
  );
}
