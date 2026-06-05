const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function App() {
  return (
    <div className="min-h-screen p-8">
      <header className="mb-8 border-b border-zinc-700 pb-4">
        <p className="text-sm uppercase tracking-widest text-amber-400">Operations</p>
        <h1 className="text-3xl font-semibold">Sentinel Admin Portal</h1>
        <p className="mt-2 max-w-xl text-zinc-400">
          Job queue, technician tasks (barcode, rack, slot), tape inventory, and compliance
          workflows.
        </p>
      </header>
      <section className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-medium">Status</h2>
        <p className="mt-2 text-zinc-400">
          Day 1 scaffold. API: <code className="text-amber-300">{apiUrl}</code>
        </p>
        <p className="mt-4 text-sm text-zinc-500">Day 13: live queue, SLA timers, complete retrieval.</p>
      </section>
    </div>
  );
}
