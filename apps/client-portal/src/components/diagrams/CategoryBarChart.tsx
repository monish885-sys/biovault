import { categoryColor, friendlyCategory } from "../../lib/labels";

type CategoryRow = { category: string; tb: number };

type Props = {
  rows: CategoryRow[];
  maxTb?: number;
};

export function CategoryBarChart({ rows, maxTb }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-center text-sm text-slate-500 py-4">No archived records yet.</p>
    );
  }

  const peak = maxTb ?? Math.max(...rows.map((r) => r.tb), 0.001);

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = Math.max(4, (row.tb / peak) * 100);
        const color = categoryColor(row.category);
        return (
          <div key={row.category}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-200">{friendlyCategory(row.category)}</span>
              <span className="text-slate-400">{row.tb} TB</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
