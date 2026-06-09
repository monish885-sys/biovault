import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";

const CLIENT_A = "507f1f77bcf86cd799439011";
const FILE_ID = "507f1f77bcf86cd799439201";
const JOB_ID = "507f1f77bcf86cd799439301";

const store = vi.hoisted(() => ({
  passwordHash: "",
  jobs: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../db/schemas/user.js", () => ({
  UserModel: {
    findOne: vi.fn((query: { email: string }) => ({
      lean: vi.fn(async () => {
        if (query.email === "ops@biovault.test") {
          return {
            _id: "507f1f77bcf86cd799439014",
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
        if (id === "507f1f77bcf86cd799439014") {
          return { _id: id, email: "ops@biovault.test", role: "ops_admin" };
        }
        if (id === "507f1f77bcf86cd799439012") {
          return { _id: id, email: "admin@acme.test", role: "client_admin", clientId: CLIENT_A };
        }
        return null;
      }),
    })),
    find: vi.fn((filter: Record<string, unknown>) => {
      const ids = (filter._id as { $in: Types.ObjectId[] })?.$in ?? [];
      const users = [
        { _id: new Types.ObjectId("507f1f77bcf86cd799439012"), email: "admin@acme.test" },
      ];
      const matched = users.filter((u) => ids.some((id) => String(id) === String(u._id)));
      return {
        select: vi.fn(() => ({
          lean: vi.fn(async () => matched),
        })),
      };
    }),
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
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => [
          { _id: new Types.ObjectId(CLIENT_A), name: "Acme Hospital" },
        ]),
      })),
    })),
  },
}));

vi.mock("../../db/schemas/file.js", () => ({
  FileModel: {
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => [
          {
            _id: new Types.ObjectId(FILE_ID),
            filename: "scan-001.dcm",
            fileType: "dcm",
            category: "imaging",
          },
        ]),
      })),
    })),
  },
}));

vi.mock("../../db/schemas/file-location.js", () => ({
  FileLocationModel: {
    find: vi.fn(() => ({
      lean: vi.fn(async () => [
        {
          fileId: new Types.ObjectId(FILE_ID),
          tapeBarcode: "LTO9-00042",
          blockId: "blk-1",
          byteOffset: 0,
        },
      ]),
    })),
  },
}));

vi.mock("../../db/schemas/tape.js", () => ({
  TapeModel: {
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => [
          { barcode: "LTO9-00042", rack: "R-A", slot: "S-12" },
        ]),
      })),
    })),
  },
}));

vi.mock("../../db/schemas/retrieval-job.js", () => ({
  RetrievalJobModel: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        skip: vi.fn(() => ({
          limit: vi.fn(() => ({
            lean: vi.fn(async () => store.jobs),
          })),
        })),
      })),
    })),
    countDocuments: vi.fn(async () => store.jobs.length),
  },
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

function seedJobs() {
  const dueAt = new Date(Date.now() + 10 * 60 * 1000);
  store.jobs = [
    {
      _id: new Types.ObjectId(JOB_ID),
      clientId: new Types.ObjectId(CLIENT_A),
      fileId: new Types.ObjectId(FILE_ID),
      requestedBy: new Types.ObjectId("507f1f77bcf86cd799439012"),
      status: "pending",
      dueAt,
      createdAt: new Date(),
    },
  ];
}

describe("admin jobs queue (Day 8)", () => {
  beforeEach(async () => {
    vi.stubEnv("SESSION_SECRET", "integration-test-secret");
    store.passwordHash = await bcrypt.hash(PASSWORD, 4);
    seedJobs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    store.jobs = [];
  });

  it("lists retrieval jobs with SLA countdown and tape location", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "ops@biovault.test", password: PASSWORD });

    const res = await agent.get("/api/v1/admin/jobs");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.jobs[0]).toMatchObject({
      id: JOB_ID,
      filename: "scan-001.dcm",
      clientName: "Acme Hospital",
      status: "pending",
      slaOverdue: false,
      tape: {
        tapeBarcode: "LTO9-00042",
        rack: "R-A",
        slot: "S-12",
      },
    });
    expect(res.body.jobs[0].slaRemainingSeconds).toBeGreaterThan(500);
    expect(res.body.jobs[0].slaRemainingSeconds).toBeLessThanOrEqual(600);
    expect(res.body.jobs[0].requestedBy).toBe("admin@acme.test");
  });

  it("blocks client users from admin jobs", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.get("/api/v1/admin/jobs");
    expect(res.status).toBe(403);
  });
});
