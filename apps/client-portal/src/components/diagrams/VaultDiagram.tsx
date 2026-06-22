export function VaultDiagram() {
  return (
    <div className="vault-card p-5">
      <h3 className="mb-1 text-lg font-semibold text-slate-100">How your records are protected</h3>
      <p className="mb-5 text-sm text-slate-400">
        A simple view of where your hospital data lives — no technical knowledge needed.
      </p>

      <svg viewBox="0 0 640 200" className="mx-auto w-full max-w-2xl" aria-label="Vault protection diagram">
        <defs>
          <linearGradient id="hospitalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#065f46" />
            <stop offset="100%" stopColor="#064e3b" />
          </linearGradient>
          <linearGradient id="vaultGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
          </marker>
        </defs>

        {/* Hospital */}
        <g transform="translate(20, 40)">
          <rect width="140" height="120" rx="12" fill="url(#hospitalGrad)" stroke="#475569" strokeWidth="1.5" />
          <rect x="55" y="20" width="30" height="25" rx="2" fill="#ef4444" opacity="0.9" />
          <rect x="20" y="55" width="35" height="30" rx="3" fill="#334155" stroke="#64748b" />
          <rect x="85" y="55" width="35" height="30" rx="3" fill="#334155" stroke="#64748b" />
          <rect x="50" y="95" width="40" height="25" rx="2" fill="#475569" />
          <text x="70" y="145" textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="600" fontFamily="system-ui">
            Your hospital
          </text>
          <text x="70" y="162" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="system-ui">
            MRI, labs, records
          </text>
        </g>

        <line x1="165" y1="100" x2="215" y2="100" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />

        {/* Online catalog */}
        <g transform="translate(220, 30)">
          <rect width="160" height="140" rx="12" fill="url(#onlineGrad)" stroke="#34d399" strokeWidth="1.5" />
          <circle cx="80" cy="50" r="22" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
          <path d="M68 50 L76 58 L94 40" stroke="#34d399" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="25" y="85" width="110" height="8" rx="2" fill="#065f46" />
          <rect x="25" y="100" width="90" height="8" rx="2" fill="#065f46" />
          <rect x="25" y="115" width="100" height="8" rx="2" fill="#065f46" />
          <text x="80" y="155" textAnchor="middle" fill="#ecfdf5" fontSize="13" fontWeight="600" fontFamily="system-ui">
            Search catalog
          </text>
          <text x="80" y="172" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontFamily="system-ui">
            Names & dates only
          </text>
        </g>

        <line x1="385" y1="100" x2="435" y2="100" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />

        {/* Offline vault */}
        <g transform="translate(440, 25)">
          <rect width="180" height="150" rx="12" fill="url(#vaultGrad)" stroke="#60a5fa" strokeWidth="1.5" />
          <rect x="15" y="15" width="28" height="70" rx="3" fill="#1e293b" stroke="#64748b" />
          <rect x="15" y="55" width="24" height="28" rx="2" fill="#059669" opacity="0.7" />
          <rect x="50" y="15" width="28" height="70" rx="3" fill="#1e293b" stroke="#64748b" />
          <rect x="50" y="30" width="24" height="43" rx="2" fill="#059669" opacity="0.5" />
          <rect x="85" y="15" width="28" height="70" rx="3" fill="#1e293b" stroke="#64748b" />
          <rect x="120" y="15" width="28" height="70" rx="3" fill="#1e293b" stroke="#64748b" strokeDasharray="3 2" opacity="0.6" />
          <rect x="10" y="95" width="160" height="6" rx="2" fill="#475569" />
          <text x="90" y="125" textAnchor="middle" fill="#bfdbfe" fontSize="11" fontWeight="600" fontFamily="system-ui">
            🔒 Offline vault
          </text>
          <text x="90" y="142" textAnchor="middle" fill="#93c5fd" fontSize="10" fontFamily="system-ui">
            LTO-9 tapes · air-gapped
          </text>
          <text x="90" y="168" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="system-ui">
            Actual files live here
          </text>
        </g>
      </svg>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { icon: "🏥", title: "You search", desc: "Find patient files by name or date in this portal." },
          { icon: "⚡", title: "We retrieve", desc: "Our team pulls the file from tape within 15 minutes." },
          { icon: "📥", title: "You download", desc: "A secure, time-limited link — then it is removed." },
        ].map((step) => (
          <div key={step.title} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-center">
            <span className="text-2xl">{step.icon}</span>
            <p className="mt-1 text-sm font-medium text-slate-200">{step.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
