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
  mfaEnabled: boolean;
};

export type AdminJob = {
  id: string;
  clientId: string;
  clientName: string;
  fileId: string;
  filename: string;
  fileType: string;
  category: string;
  status: string;
  dueAt: string;
  createdAt: string;
  slaRemainingSeconds: number;
  slaOverdue: boolean;
  requestedBy: string;
  assignedTo?: string;
  tape?: {
    tapeBarcode: string;
    rack: string;
    slot: string;
  };
};

export type AdminTape = {
  barcode: string;
  rack: string;
  slot: string;
  status: string;
  fillPercent: number;
  healthScore: string;
  writeCycles: number;
  ageDays: number;
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

export const jobsApi = {
  list: (params?: { status?: string; overdue?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.overdue) qs.set("overdue", "true");
    const q = qs.toString();
    return apiFetch<{ jobs: AdminJob[]; total: number }>(
      `/api/v1/admin/jobs${q ? `?${q}` : ""}`,
    );
  },
  assign: (jobId: string) =>
    apiFetch<{ job: { id: string; status: string } }>(`/api/v1/admin/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "assigned" }),
    }),
  start: (jobId: string) =>
    apiFetch<{ job: { id: string; status: string } }>(`/api/v1/admin/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress" }),
    }),
  complete: (jobId: string) =>
    apiFetch<{
      job: { id: string; status: string; downloadUrl: string; downloadExpiresAt: string };
    }>(`/api/v1/admin/jobs/${jobId}/complete`, { method: "POST" }),
};

export const tapesApi = {
  list: () => apiFetch<{ tapes: AdminTape[]; total: number }>("/api/v1/admin/tapes"),
};

export function absoluteDownloadUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}
