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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

export const billingApi = {
  summary: () => apiFetch<{ summary: BillingSummary }>("/api/v1/billing/summary"),
  invoice: () => apiFetch<{ invoice: unknown }>("/api/v1/billing/invoice"),
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
