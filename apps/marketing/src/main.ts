import "./index.css";

const DEMO_BASE = (import.meta.env.VITE_DEMO_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const DEMO_VIDEO_URL =
  (import.meta.env.VITE_DEMO_VIDEO_URL as string | undefined)?.trim() || "/demo-video/terravault-product-demo.webm";
const PILOT_CONTACT =
  (import.meta.env.VITE_PILOT_CONTACT as string | undefined)?.trim() || "hello@terravault.in";

function demoPath(path: string): string {
  return DEMO_BASE ? `${DEMO_BASE}${path}` : path;
}

const FEATURES = [
  {
    icon: "🔒",
    title: "Air-gapped by design",
    body: "File bytes live on LTO-9 tape offline. The dashboard indexes metadata only — nothing sensitive on internet-facing servers.",
  },
  {
    icon: "⚖️",
    title: "DPDPA-ready",
    body: "Audit trails, signed certificates, and Right to Erasure workflows built for India's Digital Personal Data Protection Act.",
  },
  {
    icon: "⚡",
    title: "15-minute retrieval SLA",
    body: "Clients search and request files online. Technicians fulfil from tape with live SLA countdowns and staging purge.",
  },
  {
    icon: "📼",
    title: "Tape health monitoring",
    body: "Track fill %, write cycles, and health scores. Proactive re-copy before media reaches end-of-life.",
  },
];

const STEPS = [
  { n: "1", label: "Ingest", detail: "SFTP or upload → SHA-256 index → tape write → verify" },
  { n: "2", label: "Archive", detail: "Cartridges shelved in Hyderabad colo — physically offline" },
  { n: "3", label: "Search", detail: "Client portal: filename, date, category — no tape location exposed" },
  { n: "4", label: "Retrieve", detail: "Request → technician → signed download → auto-purge staging" },
];

function mount() {
  const root = document.getElementById("app");
  if (!root) return;

  root.innerHTML = `
    <div class="hero-glow min-h-screen">
      <nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-xl ring-1 ring-emerald-500/30">📼</span>
          <div>
            <p class="text-sm font-semibold text-white">TerraVault</p>
            <p class="text-xs text-slate-500">Managed archival vault</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <a href="${demoPath("/client/")}" class="hidden rounded-lg px-4 py-2 text-sm text-slate-300 hover:text-white sm:inline">Client portal</a>
          <a href="${demoPath("/admin/")}" class="hidden rounded-lg px-4 py-2 text-sm text-slate-300 hover:text-white sm:inline">Operations</a>
          <a href="${demoPath("/client/")}" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">Launch demo</a>
        </div>
      </nav>

      <header class="mx-auto max-w-6xl px-6 pb-16 pt-10 text-center sm:pt-16">
        <p class="mb-4 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-medium uppercase tracking-widest text-emerald-400">
          Phase 1 · Hyderabad · DPDPA 2023
        </p>
        <h1 class="mx-auto max-w-4xl text-4xl font-bold leading-tight text-white sm:text-6xl">
          Your compliance archive,<br />
          <span class="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">offline and under control</span>
        </h1>
        <p class="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          TerraVault helps hospitals, pharma, and enterprises in India store legally required records on
          magnetic tape — secure, searchable, and DPDPA-aligned — with a modern web dashboard.
        </p>
        <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a href="${demoPath("/client/")}" class="w-full rounded-xl bg-emerald-600 px-8 py-4 text-center text-lg font-semibold text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 sm:w-auto">
            Try interactive demo →
          </a>
          <a href="#demo-video" class="w-full rounded-xl border border-slate-600 px-8 py-4 text-center text-lg font-medium text-slate-200 hover:border-slate-500 sm:w-auto">
            Watch product tour
          </a>
        </div>
        <p class="mt-6 text-sm text-slate-500">
          Sandbox environment · simulated LTO-9 tape · resets periodically · no real PHI
        </p>
      </header>

      <section id="demo-video" class="mx-auto max-w-4xl px-6 pb-20">
        <div class="glass overflow-hidden p-2">
          <h2 class="px-4 pt-4 text-center text-xl font-bold text-white">3-minute product tour</h2>
          <p class="px-4 pb-4 text-center text-sm text-slate-400">
            Search → retrieval → operations → DPDPA compliance — full workflow walkthrough
          </p>
          <video
            class="w-full rounded-lg bg-black"
            controls
            playsinline
            preload="metadata"
            poster=""
          >
            <source src="${DEMO_VIDEO_URL}" type="video/webm" />
            <source src="${DEMO_VIDEO_URL.replace(/\.webm$/, ".mp4")}" type="video/mp4" />
            Your browser does not support embedded video. <a href="${demoPath("/client/")}" class="text-emerald-400 underline">Launch the interactive demo</a>.
          </video>
        </div>
      </section>

      <section class="mx-auto max-w-6xl px-6 pb-20">
        <div class="glass grid gap-6 p-8 sm:grid-cols-2 lg:grid-cols-4">
          ${FEATURES.map(
            (f) => `
            <div>
              <span class="text-2xl">${f.icon}</span>
              <h3 class="mt-3 font-semibold text-white">${f.title}</h3>
              <p class="mt-2 text-sm leading-relaxed text-slate-400">${f.body}</p>
            </div>`,
          ).join("")}
        </div>
      </section>

      <section class="mx-auto max-w-6xl px-6 pb-20">
        <h2 class="mb-8 text-center text-2xl font-bold text-white">How it works</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          ${STEPS.map(
            (s) => `
            <div class="glass p-6">
              <span class="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">${s.n}</span>
              <h3 class="mt-4 font-semibold text-white">${s.label}</h3>
              <p class="mt-2 text-sm text-slate-400">${s.detail}</p>
            </div>`,
          ).join("")}
        </div>
      </section>

      <section class="mx-auto max-w-6xl px-6 pb-20">
        <div class="glass overflow-hidden">
          <div class="grid lg:grid-cols-2">
            <div class="border-b border-slate-700/60 p-8 lg:border-b-0 lg:border-r">
              <h2 class="text-xl font-bold text-white">Client portal</h2>
              <p class="mt-2 text-slate-400">Search archived records, request retrievals, track SLA, view billing and compliance.</p>
              <dl class="mt-6 space-y-2 text-sm">
                <div class="flex gap-2"><dt class="text-slate-500">Email</dt><dd class="font-mono text-emerald-400">admin@acme.test</dd></div>
                <div class="flex gap-2"><dt class="text-slate-500">Password</dt><dd class="font-mono text-slate-300">ChangeMe123!</dd></div>
              </dl>
              <a href="${demoPath("/client/")}" class="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500">Open client demo</a>
            </div>
            <div class="p-8">
              <h2 class="text-xl font-bold text-white">Operations portal</h2>
              <p class="mt-2 text-slate-400">Job queue with SLA timers, tape inventory with rack/slot, DPDPA erasure workflow.</p>
              <dl class="mt-6 space-y-2 text-sm">
                <div class="flex gap-2"><dt class="text-slate-500">Email</dt><dd class="font-mono text-amber-400">tech@biovault.test</dd></div>
                <div class="flex gap-2"><dt class="text-slate-500">Password</dt><dd class="font-mono text-slate-300">ChangeMe123!</dd></div>
              </dl>
              <a href="${demoPath("/admin/")}" class="mt-6 inline-block rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-500">Open operations demo</a>
            </div>
          </div>
        </div>
      </section>

      <section class="mx-auto max-w-6xl px-6 pb-24 text-center">
        <h2 class="text-2xl font-bold text-white">Hyderabad pilot — 3 founding partners</h2>
        <p class="mx-auto mt-4 max-w-2xl text-slate-400">
          Hospitals, diagnostic chains, and pharma teams: waived ingest fee for the first 90-day pilot.
          Air-gapped LTO-9 storage, searchable dashboard, signed DPDPA deletion certificates.
        </p>
        <p class="mt-6">
          <a href="mailto:${PILOT_CONTACT}?subject=TerraVault%20Hyderabad%20Pilot" class="inline-block rounded-xl bg-emerald-600 px-10 py-4 text-lg font-semibold text-white hover:bg-emerald-500">
            Request pilot details →
          </a>
        </p>
        <p class="mt-4 text-sm text-slate-500">${PILOT_CONTACT}</p>
      </section>

      <footer class="border-t border-slate-800 py-8 text-center text-sm text-slate-600">
        <p>© ${new Date().getFullYear()} TerraVault · Private demo · Not for production PHI</p>
        <p class="mt-1"><a href="/health" class="hover:text-slate-400">API health</a></p>
      </footer>
    </div>
  `;
}

mount();
