const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function App() {
  return (
    <div className="min-h-screen p-8">
      <header className="mb-8 border-b border-slate-700 pb-4">
        <p className="text-sm uppercase tracking-widest text-emerald-400">BioVault Sentinel</p>
        <h1 className="text-3xl font-semibold">Client Portal</h1>
        <p className="mt-2 max-w-xl text-slate-400">
          Phase 1 MVP — search, request retrieval, and track jobs. Tape locations are never shown
          here.
        </p>
      </header>
      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="text-lg font-medium">Status</h2>
        <p className="mt-2 text-slate-400">
          Day 1 scaffold. API: <code className="text-emerald-300">{apiUrl}</code>
        </p>
        <p className="mt-4 text-sm text-slate-500">Day 12: login, search, request, tracker UI.</p>
      </section>
    </div>
  );
}
