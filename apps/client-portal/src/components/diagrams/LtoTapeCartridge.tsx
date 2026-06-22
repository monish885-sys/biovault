type Props = {
  fillPercent: number;
  label?: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  highlight?: boolean;
};

const SIZES = {
  sm: { w: 56, h: 120, font: 8, labelH: 18 },
  md: { w: 72, h: 160, font: 9, labelH: 22 },
  lg: { w: 96, h: 210, font: 11, labelH: 28 },
};

function fillGradient(pct: number): string {
  if (pct >= 90) return "url(#tapeFillWarn)";
  if (pct >= 70) return "url(#tapeFillMid)";
  return "url(#tapeFillOk)";
}

export function LtoTapeCartridge({
  fillPercent,
  label,
  sublabel,
  size = "md",
  highlight = false,
}: Props) {
  const { w, h, font, labelH } = SIZES[size];
  const clamped = Math.min(100, Math.max(0, fillPercent));
  const bodyH = h - labelH - 8;
  const fillH = (bodyH * clamped) / 100;
  const fillY = labelH + 4 + (bodyH - fillH);

  return (
    <div
      className={`flex flex-col items-center gap-1.5 ${highlight ? "scale-105" : ""}`}
      title={label ? `${label}: ${clamped}% full` : `${clamped}% full`}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className={`drop-shadow-lg ${highlight ? "drop-shadow-emerald-500/30" : ""}`}
        aria-hidden
      >
        <defs>
          <linearGradient id="tapeFillOk" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id="tapeFillMid" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="tapeFillWarn" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
          <linearGradient id="tapeBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="tapeLabel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>

        {/* Label strip */}
        <rect x="2" y="2" width={w - 4} height={labelH} rx="3" fill="url(#tapeLabel)" stroke="#475569" strokeWidth="1" />
        <text
          x={w / 2}
          y={labelH / 2 + 3}
          textAnchor="middle"
          fill="#34d399"
          fontSize={font}
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          LTO-9
        </text>

        {/* Cartridge body */}
        <rect
          x="4"
          y={labelH + 4}
          width={w - 8}
          height={bodyH}
          rx="4"
          fill="url(#tapeBody)"
          stroke={highlight ? "#34d399" : "#475569"}
          strokeWidth={highlight ? 2 : 1}
        />

        {/* Reel windows */}
        <ellipse cx={w * 0.3} cy={labelH + bodyH * 0.35} rx={w * 0.12} ry={bodyH * 0.1} fill="#0f172a" stroke="#64748b" strokeWidth="0.5" />
        <ellipse cx={w * 0.7} cy={labelH + bodyH * 0.35} rx={w * 0.12} ry={bodyH * 0.1} fill="#0f172a" stroke="#64748b" strokeWidth="0.5" />

        {/* Data fill */}
        {clamped > 0 && (
          <rect
            x="6"
            y={fillY}
            width={w - 12}
            height={fillH}
            rx="2"
            fill={fillGradient(clamped)}
            opacity="0.85"
            className="tape-fill-animate"
          />
        )}

        {/* Fill percentage */}
        <text
          x={w / 2}
          y={labelH + bodyH * 0.72}
          textAnchor="middle"
          fill={clamped > 40 ? "#ecfdf5" : "#94a3b8"}
          fontSize={font + 2}
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
        >
          {clamped}%
        </text>

        {/* Bottom notch */}
        <rect x={w / 2 - 6} y={h - 6} width="12" height="4" rx="1" fill="#64748b" />
      </svg>
      {label && (
        <p className="max-w-[5.5rem] text-center text-[10px] font-medium leading-tight text-slate-300">
          {label}
        </p>
      )}
      {sublabel && (
        <p className="max-w-[5.5rem] text-center text-[9px] leading-tight text-slate-500">{sublabel}</p>
      )}
    </div>
  );
}
