import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";

const CLIENT_ID = "507f1f77bcf86cd799439011";
const USER_ID = "507f1f77bcf86cd799439012";

const store = vi.hoisted(() => ({
  passwordHash: "",
  jobs: [] as Array<Record<string, unknown>>,
  files: [] as Array<Record<string, unknown>>,
  locations: [] as Array<Record<string, unknown>>,
  tapes: [
    {
      _id: "507f1f77bcf86cd799439020",
      barcode: "TAPE-ACME-001",
      rack: "R1",
      slot: "S01",
      status: "empty",
      fillPercent: 0,
      writeCycles: 0,
      save: vi.fn(async function (this: Record<string, unknown>) {
        return this;
      }),
    },
  ],
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
            clientId: CLIENT_ID,
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
              clientId: CLIENT_ID,
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

vi.mock("../../db/schemas/client.js", () => ({
  ClientModel: {
    findById: vi.fn(() => ({
      lean: vi.fn(async () => ({
        _id: CLIENT_ID,
        name: "Acme Hospital",
        slug: "acme",
        tier: "standard",
        retentionPolicyYears: 7,
        dataCategories: ["imaging"],
        onboardingComplete: false,
        active: true,
      })),
    })),
  },
}));

vi.mock("../certificates/certificates.service.js", () => ({
  autoIssueIngestCertificate: vi.fn().mockResolvedValue(undefined),
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
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../db/schemas/ingest-job.js", () => ({
  IngestJobModel: {
    create: vi.fn(async (doc: Record<string, unknown>) => {
      const job = {
        _id: new Types.ObjectId(),
        ...doc,
        createdAt: new Date(),
        save: vi.fn(async function (this: Record<string, unknown>) {
          const idx = store.jobs.findIndex((j) => String(j._id) === String(this._id));
          if (idx >= 0) store.jobs[idx] = { ...this };
          else store.jobs.push({ ...this });
          return this;
        }),
      };
      store.jobs.push(job);
      return job;
    }),
    findOne: vi.fn((query: Record<string, unknown>) => ({
      lean: vi.fn(async () => {
        const job = store.jobs.find(
          (j) =>
            String(j._id) === String(query._id) &&
            String(j.clientId) === String(query.clientId),
        );
        return job ?? null;
      }),
    })),
    findById: vi.fn(async (id: string) => {
      const job = store.jobs.find((j) => String(j._id) === String(id));
      return job ?? null;
    }),
  },
}));

vi.mock("../../db/schemas/file.js", () => ({
  FileModel: {
    create: vi.fn(async (doc: Record<string, unknown>) => {
      const file = {
        _id: new Types.ObjectId(),
        ...doc,
      };
      store.files.push(file);
      return file;
    }),
    find: vi.fn((query: Record<string, unknown>) => ({
      lean: vi.fn(async () =>
        store.files.filter((f) => {
          if (query.ingestJobId && String(f.ingestJobId) !== String(query.ingestJobId)) {
            return false;
          }
          if (query.status && f.status !== query.status) return false;
          return true;
        }),
      ),
    })),
    updateOne: vi.fn(async (query: Record<string, unknown>, update: Record<string, unknown>) => {
      const file = store.files.find((f) => String(f._id) === String(query._id));
      if (file && update.$set && typeof update.$set === "object") {
        Object.assign(file, update.$set);
      }
      return { modifiedCount: file ? 1 : 0 };
    }),
  },
}));

vi.mock("../../db/schemas/tape.js", () => ({
  TapeModel: {
    findOne: vi.fn((query: Record<string, unknown>) => {
      if (query.barcode) {
        return Promise.resolve(
          store.tapes.find((t) => t.barcode === query.barcode) ?? null,
        );
      }
      return {
        sort: vi.fn(async () => {
          const tape = store.tapes.find((t) => {
            const statuses = (query.status as { $in: string[] })?.$in ?? [];
            return statuses.includes(t.status as string) && (t.fillPercent as number) < 100;
          });
          return tape ?? null;
        }),
      };
    }),
  },
}));

vi.mock("../../db/schemas/file-location.js", () => ({
  FileLocationModel: {
    create: vi.fn(async (doc: Record<string, unknown>) => {
      store.locations.push(doc);
      return doc;
    }),
    findOne: vi.fn((query: Record<string, unknown>) => ({
      lean: vi.fn(async () =>
        store.locations.find((l) => String(l.fileId) === String(query.fileId)) ?? null,
      ),
    })),
  },
}));

vi.mock("./ingest.queue.js", () => ({
  enqueueTapeWrite: vi.fn().mockResolvedValue(undefined),
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
import { processTapeVerify, processTapeWrite } from "./ingest.service.js";

const PASSWORD = "ChangeMe123!";

describe("ingest intake (Day 3)", () => {
  let stagingDir: string;

  beforeEach(async () => {
    vi.stubEnv("SESSION_SECRET", "integration-test-secret");
    stagingDir = await mkdtemp(join(tmpdir(), "sentinel-ingest-"));
    vi.stubEnv("STAGING_PATH", stagingDir);
    store.passwordHash = await bcrypt.hash(PASSWORD, 4);
    store.jobs = [];
    store.files = [];
    store.locations = [];
    store.tapes[0]!.status = "empty";
    store.tapes[0]!.fillPercent = 0;
    store.tapes[0]!.writeCycles = 0;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(stagingDir, { recursive: true, force: true });
  });

  it("indexes uploaded files with SHA-256 checksums", async () => {
    const payload = Buffer.from("patient-mri-archive");
    const expectedHash = createHash("sha256").update(payload).digest("hex");

    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent
      .post("/api/v1/ingest/jobs")
      .field("category", "imaging")
      .attach("files", payload, "scan-001.dcm");

    expect(res.status).toBe(201);
    expect(res.body.job.status).toBe("indexing");
    expect(res.body.job.fileCount).toBe(1);
    expect(res.body.job.files[0].checksumSha256).toBe(expectedHash);
    expect(res.body.job.files[0].filename).toBe("scan-001.dcm");
    expect(res.body.job.files[0].fileType).toBe("dcm");
    expect(res.body.job.files[0].category).toBe("imaging");
    expect(res.body.job).not.toHaveProperty("tapeBarcode");

    const staged = await readFile(
      join(stagingDir, "ingest", res.body.job.id, "scan-001.dcm"),
    );
    expect(staged.equals(payload)).toBe(true);
  });

  it("returns ingest job without tape location fields", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const created = await agent
      .post("/api/v1/ingest/jobs")
      .attach("files", Buffer.from("x"), "doc.pdf");

    const res = await agent.get(`/api/v1/ingest/jobs/${created.body.job.id}`);
    expect(res.status).toBe(200);
    expect(res.body.job.id).toBe(created.body.job.id);
    expect(res.body.job).not.toHaveProperty("tapeBarcode");
    expect(res.body.job).not.toHaveProperty("rack");
    expect(res.body.job).not.toHaveProperty("slot");
  });
});

describe("tape write + verify (Day 4–5)", () => {
  let stagingDir: string;

  beforeEach(async () => {
    stagingDir = await mkdtemp(join(tmpdir(), "sentinel-tape-"));
    vi.stubEnv("STAGING_PATH", stagingDir);
    vi.stubEnv("SEARCH_TOKEN_SECRET", "integration-test-search-secret");
    store.jobs = [];
    store.files = [];
    store.locations = [];
    store.tapes[0]!.status = "empty";
    store.tapes[0]!.fillPercent = 0;
    store.tapes[0]!.writeCycles = 0;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(stagingDir, { recursive: true, force: true });
  });

  it("writes files to tape simulator and records file_locations", async () => {
    const jobId = "507f1f77bcf86cd799439030";
    const fileId = "507f1f77bcf86cd799439131";
    const payload = Buffer.from("tape-payload-bytes");

    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(stagingDir, "ingest", jobId), { recursive: true });
    await writeFile(join(stagingDir, "ingest", jobId, "record.dat"), payload);

    store.jobs.push({
      _id: new Types.ObjectId(jobId),
      clientId: new Types.ObjectId(CLIENT_ID),
      status: "indexing",
      fileCount: 1,
      totalBytes: payload.length,
      save: vi.fn(async function (this: Record<string, unknown>) {
        const idx = store.jobs.findIndex((j) => String(j._id) === jobId);
        if (idx >= 0) store.jobs[idx] = { ...this };
        return this;
      }),
    });

    store.files.push({
      _id: new Types.ObjectId(fileId),
      clientId: new Types.ObjectId(CLIENT_ID),
      ingestJobId: new Types.ObjectId(jobId),
      filename: "record.dat",
      fileType: "dat",
      category: "general",
      sizeBytes: payload.length,
      checksumSha256: createHash("sha256").update(payload).digest("hex"),
      status: "indexing",
    });

    await processTapeWrite(jobId);

    const job = store.jobs.find((j) => String(j._id) === jobId);
    expect(job?.status).toBe("verifying");
    expect(job?.tapeBarcode).toBe("TAPE-ACME-001");

    expect(store.locations).toHaveLength(1);
    expect(store.locations[0]?.tapeBarcode).toBe("TAPE-ACME-001");
    expect(store.locations[0]?.fileId).toEqual(new Types.ObjectId(fileId));
    expect(store.locations[0]?.blockId).toMatch(/^blk-/);

    expect(store.tapes[0]?.writeCycles).toBe(1);
  });

  it("verifies read-back checksum, seals job, and purges ingest staging", async () => {
    const jobId = "507f1f77bcf86cd799439031";
    const fileId = "507f1f77bcf86cd799439132";
    const payload = Buffer.from("verify-me-on-tape");

    const { mkdir, writeFile } = await import("node:fs/promises");
    const ingestDir = join(stagingDir, "ingest", jobId);
    await mkdir(ingestDir, { recursive: true });
    await writeFile(join(ingestDir, "record.dat"), payload);

    store.jobs.push({
      _id: new Types.ObjectId(jobId),
      clientId: new Types.ObjectId(CLIENT_ID),
      status: "indexing",
      fileCount: 1,
      totalBytes: payload.length,
      save: vi.fn(async function (this: Record<string, unknown>) {
        const idx = store.jobs.findIndex((j) => String(j._id) === jobId);
        if (idx >= 0) store.jobs[idx] = { ...this };
        return this;
      }),
    });

    store.files.push({
      _id: new Types.ObjectId(fileId),
      clientId: new Types.ObjectId(CLIENT_ID),
      ingestJobId: new Types.ObjectId(jobId),
      filename: "record.dat",
      fileType: "dat",
      category: "general",
      sizeBytes: payload.length,
      checksumSha256: createHash("sha256").update(payload).digest("hex"),
      status: "indexing",
    });

    await processTapeWrite(jobId);
    expect(store.jobs.find((j) => String(j._id) === jobId)?.status).toBe("verifying");

    await processTapeVerify(jobId);

    const job = store.jobs.find((j) => String(j._id) === jobId);
    expect(job?.status).toBe("sealed");
    expect(job?.sealedAt).toBeInstanceOf(Date);
    expect(store.files[0]?.status).toBe("on_tape");
    expect(store.tapes[0]?.status).toBe("active");

    await expect(access(ingestDir)).rejects.toThrow();
  });

  it("returns 404 for ingest report before job is sealed", async () => {
    vi.stubEnv("SESSION_SECRET", "integration-test-secret");
    store.passwordHash = await bcrypt.hash(PASSWORD, 4);

    const jobId = "507f1f77bcf86cd799439040";
    store.jobs.push({
      _id: new Types.ObjectId(jobId),
      clientId: new Types.ObjectId(CLIENT_ID),
      status: "verifying",
      fileCount: 1,
      totalBytes: 10,
      createdAt: new Date(),
    });

    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.get(`/api/v1/ingest/jobs/${jobId}/report`);
    expect(res.status).toBe(404);
  });

  it("returns sealed ingest report without tape location fields", async () => {
    vi.stubEnv("SESSION_SECRET", "integration-test-secret");
    store.passwordHash = await bcrypt.hash(PASSWORD, 4);

    const jobId = "507f1f77bcf86cd799439041";
    const sealedAt = new Date("2026-06-07T12:00:00.000Z");
    store.jobs.push({
      _id: new Types.ObjectId(jobId),
      clientId: new Types.ObjectId(CLIENT_ID),
      status: "sealed",
      fileCount: 1,
      totalBytes: 18,
      sealedAt,
      createdAt: new Date("2026-06-07T11:00:00.000Z"),
    });
    store.files.push({
      _id: new Types.ObjectId("507f1f77bcf86cd799439142"),
      clientId: new Types.ObjectId(CLIENT_ID),
      ingestJobId: new Types.ObjectId(jobId),
      filename: "sealed-record.dat",
      fileType: "dat",
      category: "imaging",
      sizeBytes: 18,
      checksumSha256: "abc123",
      status: "on_tape",
    });

    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.get(`/api/v1/ingest/jobs/${jobId}/report`);
    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe("sealed");
    expect(res.body.report.sealedAt).toBe(sealedAt.toISOString());
    expect(res.body.report.files[0].verified).toBe(true);
    expect(res.body.report).not.toHaveProperty("tapeBarcode");
    expect(res.body.report).not.toHaveProperty("rack");
    expect(res.body.report).not.toHaveProperty("slot");
  });

  it("marks job failed when read-back checksum mismatches", async () => {
    const jobId = "507f1f77bcf86cd799439032";
    const fileId = "507f1f77bcf86cd799439133";
    const payload = Buffer.from("checksum-mismatch-payload");

    const { mkdir, writeFile } = await import("node:fs/promises");
    const ingestDir = join(stagingDir, "ingest", jobId);
    await mkdir(ingestDir, { recursive: true });
    await writeFile(join(ingestDir, "record.dat"), payload);

    store.jobs.push({
      _id: new Types.ObjectId(jobId),
      clientId: new Types.ObjectId(CLIENT_ID),
      status: "indexing",
      fileCount: 1,
      totalBytes: payload.length,
      save: vi.fn(async function (this: Record<string, unknown>) {
        const idx = store.jobs.findIndex((j) => String(j._id) === jobId);
        if (idx >= 0) store.jobs[idx] = { ...this };
        return this;
      }),
    });

    store.files.push({
      _id: new Types.ObjectId(fileId),
      clientId: new Types.ObjectId(CLIENT_ID),
      ingestJobId: new Types.ObjectId(jobId),
      filename: "record.dat",
      fileType: "dat",
      category: "general",
      sizeBytes: payload.length,
      checksumSha256: createHash("sha256").update("wrong-bytes").digest("hex"),
      status: "indexing",
    });

    await processTapeWrite(jobId);
    await expect(processTapeVerify(jobId)).rejects.toThrow(/checksum mismatch/i);

    const job = store.jobs.find((j) => String(j._id) === jobId);
    expect(job?.status).toBe("failed");
    expect(store.files[0]?.status).toBe("indexing");
    expect(store.tapes[0]?.status).toBe("active");
    await expect(access(ingestDir)).resolves.toBeUndefined();
  });
});
