const API_BASE = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_URL ?? "");

type ApiError = { error: string; message: string };

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T | ApiError;
  if (!res.ok) {
    const err = data as ApiError;
    throw new Error(err.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

const PORTAL_HEADER = "X-Sentinel-Portal";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      [PORTAL_HEADER]: "client",
      ...init?.headers,
    },
  });
  return parseJson<T>(res);
}

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  clientId?: string;
  mfaEnabled: boolean;
};

export type FileSearchResult = {
  id: string;
  filename: string;
  fileType: string;
  category: string;
  ingestedAt: string;
};

export type RetrievalJob = {
  id: string;
  fileId: string;
  filename: string;
  fileType: string;
  category: string;
  status: string;
  dueAt: string;
  createdAt: string;
  slaRemainingSeconds: number;
  slaOverdue: boolean;
  downloadUrl?: string;
  downloadExpiresAt?: string;
};

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ user: AuthUser }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => apiFetch<void>("/api/v1/auth/logout", { method: "POST" }),
  me: () => apiFetch<{ user: AuthUser }>("/api/v1/auth/me"),
};

export const searchApi = {
  files: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch<{ files: FileSearchResult[]; total: number }>(
      `/api/v1/search/files?${qs}`,
    );
  },
};

export const retrievalApi = {
  list: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch<{ jobs: RetrievalJob[]; total: number }>(`/api/v1/retrieval/jobs${qs}`);
  },
  create: (fileId: string) =>
    apiFetch<{ job: RetrievalJob }>("/api/v1/retrieval/jobs", {
      method: "POST",
      body: JSON.stringify({ fileId }),
    }),
  download: async (downloadUrl: string, filename: string): Promise<void> => {
    const path = downloadUrl.startsWith("http") ? downloadUrl : `${API_BASE}${downloadUrl}`;
    const res = await fetch(path, {
      credentials: "include",
      headers: { "X-Sentinel-Portal": "client" },
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as ApiError;
      throw new Error(err.message ?? `Download failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export function absoluteDownloadUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

export type BillingSummary = {
  tier: string;
  storageBytes: number;
  storageTb: number;
  storageIncludedTb: number;
  storageOverageTb: number;
  retrievalsUsed: number;
  retrievalsIncluded: number;
  retrievalsOverage: number;
  estimatedMonthlyInr: number;
  cloudComparisonInr: number;
  savingsVsCloudInr: number;
  byCategory: Array<{ category: string; bytes: number; tb: number }>;
};

export type InvoicePreview = {
  period: string;
  lineItems: Array<{ label: string; quantity: number; unitInr: number; totalInr: number }>;
  subtotalInr: number;
  estimatedTotalInr: number;
};

export type ErasureRequest = {
  id: string;
  subjectId: string;
  reason: string;
  searchQuery: string;
  status: string;
  matchedFileCount: number;
  createdAt: string;
  certificateId?: string;
};

export type AuditExport = {
  events: Array<{ action: string; timestamp: string }>;
  chainValid: boolean;
};

export type ClientVaultSummary = {
  storageTb: number;
  storageIncludedTb: number;
  storageRemainingTb: number;
  byCategory: Array<{ category: string; tb: number }>;
};

export type ClientProfile = {
  id: string;
  name: string;
  slug: string;
  tier: string;
  retentionPolicyYears: number;
  dataCategories: string[];
  onboardingComplete: boolean;
  vault: ClientVaultSummary;
};

export const clientApi = {
  me: () => apiFetch<{ client: ClientProfile }>("/api/v1/clients/me"),
};

export const billingApi = {
  summary: () => apiFetch<{ summary: BillingSummary }>("/api/v1/billing/summary"),
  invoice: () => apiFetch<{ invoice: InvoicePreview }>("/api/v1/billing/invoice"),
};

export const auditApi = {
  exportUrl: () => `${API_BASE}/api/v1/audit/export`,
  export: async () => {
    const res = await fetch(`${API_BASE}/api/v1/audit/export`, {
      credentials: "include",
      headers: { "X-Sentinel-Portal": "client" },
    });
    if (!res.ok) throw new Error("Audit export failed");
    return res.json() as Promise<AuditExport>;
  },
};

export const erasureApi = {
  list: () => apiFetch<{ requests: ErasureRequest[]; total: number }>("/api/v1/erasure/requests"),
  create: (body: { subjectId: string; reason: string; searchQuery: string }) =>
    apiFetch<{ request: ErasureRequest }>("/api/v1/erasure/requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  certificateDownloadUrl: (requestId: string) =>
    `${API_BASE}/api/v1/erasure/requests/${requestId}/certificate/download`,
};
