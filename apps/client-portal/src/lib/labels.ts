const CATEGORY_LABELS: Record<string, string> = {
  imaging: "Medical imaging",
  lab_reports: "Lab reports",
  clinical: "Clinical records",
  uncategorized: "Other records",
};

const CATEGORY_COLORS: Record<string, string> = {
  imaging: "#34d399",
  lab_reports: "#60a5fa",
  clinical: "#a78bfa",
  uncategorized: "#94a3b8",
};

export function friendlyCategory(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ");
}

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#64748b";
}

export const TIER_LABELS: Record<string, string> = {
  base: "Essential",
  standard: "Standard",
  enterprise: "Enterprise",
};
