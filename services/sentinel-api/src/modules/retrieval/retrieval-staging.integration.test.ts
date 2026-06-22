import { createHash } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";

const CLIENT_A = "507f1f77bcf86cd799439011";
const OPS_USER = "507f1f77bcf86cd799439014";
const FILE_ID = "507f1f77bcf86cd799439201";
const JOB_ID = "507f1f77bcf86cd799439301";
const TAPE_BARCODE = "TAPE-ACME-001";

const store = vi.hoisted(() => ({
  passwordHash: "",
  jobs: [] as Array<Record<string, unknown>>,
  files: [] as Array<Record<string, unknown>>,
  locations: [] as Array<Record<string, unknown>>,
  auditEvents: [] as Array<Record<string, unknown>>,
  enqueuedExpiries: [] as string[],
}));

vi.mock("../../db/schemas/user.js", () => ({
  UserModel: {
    findOne: vi.fn((query: { email: string }) => ({
      lean: vi.fn(async () => {
        if (query.email === "ops@biovault.test") {
          return {
            _id: OPS_USER,
            email: "ops@biovault.test",
            passwordHash: store.passwordHash,
            role: "ops_admin",
            mfaEnabled: false,
            active: true,
          };
        }
        if (query.email === "admin@acme.test") {
          return {
            _id: "507f1f77bcf86cd799439012",
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
      lean: vi.fn(async () => {
        if (id === OPS_USER) return { _id: id, email: "ops@biovault.test", role: "ops_admin" };
        if (id === "507f1f77bcf86cd799439012") {
          return { _id: id, email: "admin@acme.test", role: "client_admin", clientId: CLIENT_A };
        }
        return null;
      }),
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
    findById: vi.fn((id: string) => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => store.files.find((f) => String(f._id) === String(id)) ?? null),
      })),
      lean: vi.fn(async () => store.files.find((f) => String(f._id) === String(id)) ?? null),
    })),
    findOne: vi.fn((filter: Record<string, unknown>) => ({
      lean: vi.fn(async () =>
        store.files.find(
          (f) =>
            String(f._id) === String(filter._id) &&
            String(f.clientId) === String(filter.clientId),
        ) ?? null,
      ),
    })),
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => store.files),
      })),
    })),
  },
}));

vi.mock("../../db/schemas/file-location.js", () => ({
  FileLocationModel: {
    findOne: vi.fn((filter: Record<string, unknown>) => ({
      lean: vi.fn(async () =>
        store.locations.find((l) => String(l.fileId) === String(filter.fileId)) ?? null,
      ),
    })),
  },
}));

vi.mock("../../db/schemas/retrieval-job.js", () => ({
  RetrievalJobModel: {
    findById: vi.fn((id: string) => {
      const job = store.jobs.find((j) => String(j._id) === String(id));
      if (!job) return Promise.resolve(null);
      return Promise.resolve(job);
    }),
    findOne: vi.fn((filter: Record<string, unknown>) => ({
      lean: vi.fn(async () =>
        store.jobs.find(
          (j) =>
            String(j._id) === String(filter._id) &&
            String(j.clientId) === String(filter.clientId),
        ) ?? null,
      ),
    })),
  },
}));

vi.mock("./retrieval.queue.js", () => ({
  enqueueUnassignedAlert: vi.fn(),
  enqueueDownloadExpiry: vi.fn(async (jobId: string) => {
    store.enqueuedExpiries.push(jobId);
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

function makeSavableJob(doc: Record<string, unknown>) {
  const job = {
    ...doc,
    save: vi.fn(async function (this: Record<string, unknown>) {
      const idx = store.jobs.findIndex((j) => String(j._id) === String(this._id));
      if (idx >= 0) store.jobs[idx] = { ...this };
      else store.jobs.push({ ...this });
      return this;
    }),
  };
  store.jobs.push(job);
  return job;
}

describe("retrieval staging + download (Day 9)", () => {
  let stagingDir: string;
  const payload = Buffer.from("retrieval-payload-bytes");

  beforeEach(async () => {
    stagingDir = join(tmpdir(), `sentinel-retrieval-${Date.now()}`);
    await mkdir(stagingDir, { recursive: true });
    vi.stubEnv("STAGING_PATH", stagingDir);
    vi.stubEnv("SESSION_SECRET", "integration-test-secret");
    vi.stubEnv("SEARCH_TOKEN_SECRET", "integration-test-search-secret");
    vi.stubEnv("DOWNLOAD_TOKEN_SECRET", "integration-test-download-secret");
    store.passwordHash = await bcrypt.hash(PASSWORD, 4);
    store.jobs = [];
    store.files = [];
    store.locations = [];
    store.auditEvents = [];
    store.enqueuedExpiries = [];

    const blockId = "blk-000001";
    const tapeDir = join(stagingDir, "tape-sim", TAPE_BARCODE);
    await mkdir(tapeDir, { recursive: true });
    await writeFile(join(tapeDir, `${blockId}.bin`), payload);

    store.files.push({
      _id: new Types.ObjectId(FILE_ID),
      clientId: new Types.ObjectId(CLIENT_A),
      filename: "scan-001.dcm",
      fileType: "dcm",
      category: "imaging",
      status: "on_tape",
      checksumSha256: createHash("sha256").update(payload).digest("hex"),
    });

    store.locations.push({
      fileId: new Types.ObjectId(FILE_ID),
      tapeBarcode: TAPE_BARCODE,
      blockId,
      byteOffset: 0,
    });

    makeSavableJob({
      _id: new Types.ObjectId(JOB_ID),
      clientId: new Types.ObjectId(CLIENT_A),
      fileId: new Types.ObjectId(FILE_ID),
      requestedBy: new Types.ObjectId("507f1f77bcf86cd799439012"),
      status: "in_progress",
      dueAt: new Date(Date.now() + 15 * 60 * 1000),
      assignedTo: new Types.ObjectId(OPS_USER),
    });

  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(stagingDir, { recursive: true, force: true });
  });

  it("completes job, issues signed download URL, and purges staging after download", async () => {
    const app = createApp();
    const opsAgent = request.agent(app);
    await opsAgent
      .post("/api/v1/auth/login")
      .send({ email: "ops@biovault.test", password: PASSWORD });

    const complete = await opsAgent.post(`/api/v1/admin/jobs/${JOB_ID}/complete`);
    expect(complete.status).toBe(200);
    expect(complete.body.job.status).toBe("ready");
    expect(complete.body.job.stagedForClient).toBe(true);
    expect(complete.body.job).not.toHaveProperty("downloadUrl");
    expect(store.enqueuedExpiries).toContain(JOB_ID);
    expect(store.auditEvents.some((e) => e.action === "retrieval.staged")).toBe(true);
    expect(store.auditEvents.some((e) => e.action === "retrieval.client_notified")).toBe(true);

    const stagingPath = join(stagingDir, "retrieval", JOB_ID, "scan-001.dcm");
    await expect(access(stagingPath)).resolves.toBeUndefined();

    const clientAgent = request.agent(app);
    await clientAgent
      .post("/api/v1/auth/login")
      .send({ email: "admin@acme.test", password: PASSWORD });

    const job = store.jobs.find((j) => String(j._id) === JOB_ID);
    const downloadToken = job?.downloadToken;
    expect(downloadToken).toBeTruthy();

    const download = await clientAgent.get(
      `/api/v1/retrieval/download?token=${encodeURIComponent(downloadToken!)}`,
    );
    expect(download.status).toBe(200);
    expect(download.body.toString()).toBe(payload.toString());

    expect(store.jobs.find((j) => String(j._id) === JOB_ID)?.status).toBe("delivered");
    await expect(access(stagingPath)).rejects.toThrow();
    expect(store.auditEvents.some((e) => e.action === "retrieval.downloaded")).toBe(true);
    expect(
      store.auditEvents.some(
        (e) =>
          e.action === "retrieval.downloaded" &&
          String(e.userId) === "507f1f77bcf86cd799439012",
      ),
    ).toBe(true);
    expect(store.auditEvents.some((e) => e.action === "retrieval.staging_purged")).toBe(true);
  });

  it("exposes downloadUrl on client tracker when job is ready", async () => {
    const app = createApp();
    const opsAgent = request.agent(app);
    await opsAgent
      .post("/api/v1/auth/login")
      .send({ email: "ops@biovault.test", password: PASSWORD });
    await opsAgent.post(`/api/v1/admin/jobs/${JOB_ID}/complete`);

    const clientAgent = request.agent(app);
    await clientAgent
      .post("/api/v1/auth/login")
      .send({ email: "admin@acme.test", password: PASSWORD });

    const res = await clientAgent.get(`/api/v1/retrieval/jobs/${JOB_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.job.downloadUrl).toMatch(/^\/api\/v1\/retrieval\/download\?token=/);
    expect(res.body.job).not.toHaveProperty("tapeBarcode");
  });
});
