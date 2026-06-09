import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { RETRIEVAL_SLA_MS } from "./retrieval.constants.js";

const CLIENT_A = "507f1f77bcf86cd799439011";
const USER_ID = "507f1f77bcf86cd799439012";
const FILE_ON_TAPE = "507f1f77bcf86cd799439201";
const FILE_INDEXING = "507f1f77bcf86cd799439203";

const store = vi.hoisted(() => ({
  passwordHash: "",
  files: [] as Array<Record<string, unknown>>,
  jobs: [] as Array<Record<string, unknown>>,
  auditEvents: [] as Array<Record<string, unknown>>,
  enqueuedAlerts: [] as string[],
}));

vi.mock("../../db/schemas/user.js", () => ({
  UserModel: {
    findOne: vi.fn((query: { email: string }) => ({
      lean: vi.fn(async () => {
        if (query.email === "admin@acme.test") {
          return {
            _id: USER_ID,
            email: "admin@acme.test",
            passwordHash: store.passwordHash,
            role: "client_admin",
            clientId: CLIENT_A,
            mfaEnabled: false,
            active: true,
          };
        }
        return null;
      }),
    })),
    findById: vi.fn((id: string) => ({
      lean: vi.fn(async () =>
        id === USER_ID
          ? {
              _id: USER_ID,
              email: "admin@acme.test",
              role: "client_admin",
              clientId: CLIENT_A,
              mfaEnabled: false,
              active: true,
            }
          : null,
      ),
    })),
  },
  CLIENT_ROLES: ["client_admin", "client_viewer", "compliance_officer"],
  INTERNAL_ROLES: ["ops_admin", "technician"],
  ALL_ROLES: [
    "client_admin",
    "client_viewer",
    "compliance_officer",
    "ops_admin",
    "technician",
  ],
}));

vi.mock("../../db/schemas/audit-event.js", () => ({
  AuditEventModel: {
    findOne: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      }),
    }),
    create: vi.fn(async (doc: Record<string, unknown>) => {
      store.auditEvents.push(doc);
      return doc;
    }),
  },
}));

vi.mock("../../db/schemas/file.js", () => ({
  FileModel: {
    findOne: vi.fn((filter: Record<string, unknown>) => ({
      lean: vi.fn(async () =>
        store.files.find(
          (f) =>
            String(f._id) === String(filter._id) &&
            String(f.clientId) === String(filter.clientId),
        ) ?? null,
      ),
    })),
    find: vi.fn((filter: Record<string, unknown>) => {
      const ids = (filter._id as { $in: Types.ObjectId[] })?.$in ?? [];
      const matched = store.files.filter((f) =>
        ids.some((id) => String(id) === String(f._id)),
      );
      return {
        select: vi.fn(() => ({
          lean: vi.fn(async () => matched),
        })),
      };
    }),
    findById: vi.fn((id: string) => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => store.files.find((f) => String(f._id) === String(id)) ?? null),
      })),
    })),
  },
}));

vi.mock("../../db/schemas/retrieval-job.js", () => ({
  RetrievalJobModel: {
    findOne: vi.fn((filter: Record<string, unknown>) => ({
      lean: vi.fn(async () => {
        if (filter._id && filter.clientId) {
          return (
            store.jobs.find(
              (j) =>
                String(j._id) === String(filter._id) &&
                String(j.clientId) === String(filter.clientId),
            ) ?? null
          );
        }
        if (filter.fileId && filter.status?.$in) {
          const statuses = filter.status.$in as string[];
          return (
            store.jobs.find(
              (j) =>
                String(j.fileId) === String(filter.fileId) &&
                String(j.clientId) === String(filter.clientId) &&
                statuses.includes(j.status as string),
            ) ?? null
          );
        }
        return null;
      }),
    })),
    create: vi.fn(async (doc: Record<string, unknown>) => {
      const job = {
        _id: new Types.ObjectId(),
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.jobs.push(job);
      return job;
    }),
    find: vi.fn((filter: Record<string, unknown>) => {
      const matched = store.jobs.filter((j) => String(j.clientId) === String(filter.clientId));
      if (filter.status) {
        const filtered = matched.filter((j) => j.status === filter.status);
        return {
          sort: vi.fn(() => ({
            skip: vi.fn((offset: number) => ({
              limit: vi.fn((limit: number) => ({
                lean: vi.fn(async () => filtered.slice(offset, offset + limit)),
              })),
            })),
          })),
        };
      }
      return {
        sort: vi.fn(() => ({
          skip: vi.fn((offset: number) => ({
            limit: vi.fn((limit: number) => ({
              lean: vi.fn(async () => matched.slice(offset, offset + limit)),
            })),
          })),
        })),
      };
    }),
    countDocuments: vi.fn(async (filter: Record<string, unknown>) =>
      store.jobs.filter((j) => String(j.clientId) === String(filter.clientId)).length,
    ),
  },
}));

vi.mock("./retrieval.queue.js", () => ({
  enqueueUnassignedAlert: vi.fn(async (jobId: string) => {
    store.enqueuedAlerts.push(jobId);
  }),
}));

vi.mock("../../db/connect.js", () => ({
  connectMongo: vi.fn(),
  disconnectMongo: vi.fn(),
  mongoReady: () => true,
}));

vi.mock("../../redis.js", () => ({
  pingRedis: vi.fn().mockResolvedValue(true),
  getRedis: vi.fn(),
  closeRedis: vi.fn(),
}));

import { createApp } from "../../app.js";

const PASSWORD = "ChangeMe123!";

function seedFiles() {
  store.files = [
    {
      _id: new Types.ObjectId(FILE_ON_TAPE),
      clientId: new Types.ObjectId(CLIENT_A),
      filename: "scan-001.dcm",
      fileType: "dcm",
      category: "imaging",
      status: "on_tape",
    },
    {
      _id: new Types.ObjectId(FILE_INDEXING),
      clientId: new Types.ObjectId(CLIENT_A),
      filename: "pending.dat",
      fileType: "dat",
      category: "general",
      status: "indexing",
    },
  ];
}

describe("retrieval jobs (Day 7)", () => {
  beforeEach(async () => {
    vi.stubEnv("SESSION_SECRET", "integration-test-secret");
    vi.stubEnv("SEARCH_TOKEN_SECRET", "integration-test-search-secret");
    store.passwordHash = await bcrypt.hash(PASSWORD, 4);
    store.files = [];
    store.jobs = [];
    store.auditEvents = [];
    store.enqueuedAlerts = [];
    seedFiles();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a retrieval job with dueAt +15m and enqueues 60s alert", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const before = Date.now();
    const res = await agent.post("/api/v1/retrieval/jobs").send({ fileId: FILE_ON_TAPE });
    const after = Date.now();

    expect(res.status).toBe(201);
    expect(res.body.job).toMatchObject({
      fileId: FILE_ON_TAPE,
      filename: "scan-001.dcm",
      status: "pending",
      slaOverdue: false,
    });

    const dueAtMs = new Date(res.body.job.dueAt).getTime();
    expect(dueAtMs).toBeGreaterThanOrEqual(before + RETRIEVAL_SLA_MS);
    expect(dueAtMs).toBeLessThanOrEqual(after + RETRIEVAL_SLA_MS);
    expect(res.body.job.slaRemainingSeconds).toBeGreaterThan(890);
    expect(res.body.job.slaRemainingSeconds).toBeLessThanOrEqual(900);

    expect(store.enqueuedAlerts).toHaveLength(1);
    expect(store.auditEvents.some((e) => e.action === "retrieval.job_requested")).toBe(true);
  });

  it("never exposes tape location in client retrieval response", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.post("/api/v1/retrieval/jobs").send({ fileId: FILE_ON_TAPE });
    expect(res.status).toBe(201);
    expect(res.body.job).not.toHaveProperty("tapeBarcode");
    expect(res.body.job).not.toHaveProperty("rack");
    expect(res.body.job).not.toHaveProperty("slot");
    expect(res.body.job).not.toHaveProperty("tape");
  });

  it("rejects retrieval for files not on tape", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.post("/api/v1/retrieval/jobs").send({ fileId: FILE_INDEXING });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate active retrieval for same file", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const first = await agent.post("/api/v1/retrieval/jobs").send({ fileId: FILE_ON_TAPE });
    expect(first.status).toBe(201);

    const second = await agent.post("/api/v1/retrieval/jobs").send({ fileId: FILE_ON_TAPE });
    expect(second.status).toBe(400);
  });

  it("lists and fetches client retrieval jobs", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const created = await agent.post("/api/v1/retrieval/jobs").send({ fileId: FILE_ON_TAPE });
    const jobId = created.body.job.id;

    const list = await agent.get("/api/v1/retrieval/jobs");
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.jobs[0].id).toBe(jobId);

    const detail = await agent.get(`/api/v1/retrieval/jobs/${jobId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.job.filename).toBe("scan-001.dcm");
  });
});
