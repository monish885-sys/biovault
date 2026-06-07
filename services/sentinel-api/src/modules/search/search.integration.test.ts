import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { buildFilenameSearchTokens } from "../../search/filename-tokens.js";
import { buildKeywordSearchTokens } from "../../search/keyword-tokens.js";

const CLIENT_A = "507f1f77bcf86cd799439011";
const CLIENT_B = "507f1f77bcf86cd799439099";
const USER_ID = "507f1f77bcf86cd799439012";

const store = vi.hoisted(() => ({
  passwordHash: "",
  files: [] as Array<Record<string, unknown>>,
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
        if (query.email === "viewer@acme.test") {
          return {
            _id: "507f1f77bcf86cd799439013",
            email: "viewer@acme.test",
            passwordHash: store.passwordHash,
            role: "client_viewer",
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
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../db/schemas/file.js", () => ({
  FileModel: {
    find: vi.fn((filter: Record<string, unknown>) => {
      const matched = store.files.filter((file) => matchesFileFilter(file, filter));
      return {
        sort: vi.fn(() => ({
          skip: vi.fn((offset: number) => ({
            limit: vi.fn((limit: number) => ({
              select: vi.fn(() => ({
                lean: vi.fn(async () => matched.slice(offset, offset + limit)),
              })),
            })),
          })),
        })),
      };
    }),
    countDocuments: vi.fn(async (filter: Record<string, unknown>) =>
      store.files.filter((file) => matchesFileFilter(file, filter)).length,
    ),
  },
}));

function matchesFileFilter(file: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  if (String(filter.clientId) !== String(file.clientId)) return false;
  if (filter.status && file.status !== filter.status) return false;
  if (filter.category && file.category !== filter.category) return false;
  if (filter.fileType && file.fileType !== filter.fileType) return false;

  const createdAtFilter = filter.createdAt as Record<string, Date> | undefined;
  if (createdAtFilter) {
    const createdAt = file.createdAt as Date;
    if (createdAtFilter.$gte && createdAt < createdAtFilter.$gte) return false;
    if (createdAtFilter.$lte && createdAt > createdAtFilter.$lte) return false;
  }

  const andClauses = filter.$and as Array<Record<string, unknown>> | undefined;
  if (andClauses?.length) {
    for (const clause of andClauses) {
      const orClause = clause.$or as Array<Record<string, unknown>>;
      const filenameTokens = file.filenameSearchTokens as string[];
      const keywordTokens = file.keywordSearchTokens as string[];
      const token = orClause[0]?.filenameSearchTokens as string;
      const matches =
        filenameTokens.includes(token) || keywordTokens.includes(token);
      if (!matches) return false;
    }
  }

  return true;
}

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

function seedFiles(clientId: string) {
  const ingestedAt = new Date("2026-05-15T10:00:00.000Z");
  store.files = [
    {
      _id: new Types.ObjectId("507f1f77bcf86cd799439201"),
      clientId: new Types.ObjectId(clientId),
      filename: "scan-001.dcm",
      filenameSearchTokens: buildFilenameSearchTokens("scan-001.dcm", clientId),
      keywordSearchTokens: buildKeywordSearchTokens({ patient: "P-1001" }, clientId),
      fileType: "dcm",
      category: "imaging",
      status: "on_tape",
      createdAt: ingestedAt,
    },
    {
      _id: new Types.ObjectId("507f1f77bcf86cd799439202"),
      clientId: new Types.ObjectId(clientId),
      filename: "report-2024.pdf",
      filenameSearchTokens: buildFilenameSearchTokens("report-2024.pdf", clientId),
      keywordSearchTokens: [],
      fileType: "pdf",
      category: "reports",
      status: "on_tape",
      createdAt: new Date("2026-06-01T08:00:00.000Z"),
    },
    {
      _id: new Types.ObjectId("507f1f77bcf86cd799439203"),
      clientId: new Types.ObjectId(clientId),
      filename: "pending.dat",
      filenameSearchTokens: buildFilenameSearchTokens("pending.dat", clientId),
      keywordSearchTokens: [],
      fileType: "dat",
      category: "general",
      status: "indexing",
      createdAt: new Date("2026-06-02T08:00:00.000Z"),
    },
    {
      _id: new Types.ObjectId("507f1f77bcf86cd799439204"),
      clientId: new Types.ObjectId(CLIENT_B),
      filename: "other-client.dcm",
      filenameSearchTokens: buildFilenameSearchTokens("other-client.dcm", CLIENT_B),
      keywordSearchTokens: [],
      fileType: "dcm",
      category: "imaging",
      status: "on_tape",
      createdAt: ingestedAt,
    },
  ];
}

describe("search files (Day 6)", () => {
  beforeEach(async () => {
    vi.stubEnv("SESSION_SECRET", "integration-test-secret");
    vi.stubEnv("SEARCH_TOKEN_SECRET", "integration-test-search-secret");
    store.passwordHash = await bcrypt.hash(PASSWORD, 4);
    seedFiles(CLIENT_A);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    store.files = [];
  });

  it("returns only on_tape files for the authenticated tenant", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.get("/api/v1/search/files");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.files).toHaveLength(2);
    const filenames = res.body.files.map((f: { filename: string }) => f.filename);
    expect(filenames).toContain("scan-001.dcm");
    expect(filenames).toContain("report-2024.pdf");
    expect(filenames).not.toContain("pending.dat");
    expect(filenames).not.toContain("other-client.dcm");
  });

  it("never exposes tape location fields in search results", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.get("/api/v1/search/files");
    expect(res.status).toBe(200);
    for (const file of res.body.files) {
      expect(file).not.toHaveProperty("tapeBarcode");
      expect(file).not.toHaveProperty("rack");
      expect(file).not.toHaveProperty("slot");
      expect(file).not.toHaveProperty("checksumSha256");
      expect(file).toHaveProperty("ingestedAt");
    }
  });

  it("filters by filename token query", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.get("/api/v1/search/files").query({ q: "scan 001" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.files[0].filename).toBe("scan-001.dcm");
  });

  it("filters by keyword metadata tokens", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.get("/api/v1/search/files").query({ q: "P-1001" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.files[0].filename).toBe("scan-001.dcm");
  });

  it("filters by category and fileType", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent
      .get("/api/v1/search/files")
      .query({ category: "reports", fileType: "pdf" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.files[0].filename).toBe("report-2024.pdf");
  });

  it("filters by ingest date range", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent
      .get("/api/v1/search/files")
      .query({ from: "2026-05-01", to: "2026-05-31" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.files[0].filename).toBe("scan-001.dcm");
  });

  it("rejects invalid date parameters", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.get("/api/v1/search/files").query({ from: "not-a-date" });
    expect(res.status).toBe(400);
  });

  it("allows client_viewer role to search", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "viewer@acme.test", password: PASSWORD });

    const res = await agent.get("/api/v1/search/files");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });
});
