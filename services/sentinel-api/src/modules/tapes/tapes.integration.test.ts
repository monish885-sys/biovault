import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
const store = vi.hoisted(() => ({
  passwordHash: "",
  tapes: [] as Array<Record<string, unknown>>,
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
            clientId: "507f1f77bcf86cd799439011",
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
    create: vi.fn(async (doc: Record<string, unknown>) => doc),
  },
}));

vi.mock("../../db/schemas/tape.js", () => ({
  TapeModel: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        lean: vi.fn(async () => store.tapes),
      })),
    })),
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

describe("tape inventory (Day 10)", () => {
  beforeEach(async () => {
    vi.stubEnv("SESSION_SECRET", "integration-test-secret");
    vi.stubEnv("SEARCH_TOKEN_SECRET", "integration-test-search-secret");
    store.passwordHash = await bcrypt.hash(PASSWORD, 4);
    const now = new Date();
    store.tapes = [
      {
        barcode: "LTO9-00042",
        rack: "R-A",
        slot: "S-12",
        status: "active",
        fillPercent: 45,
        healthScore: "green",
        writeCycles: 12,
        purchasedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        barcode: "LTO9-00099",
        rack: "R-B",
        slot: "S-03",
        status: "full",
        fillPercent: 100,
        healthScore: "green",
        writeCycles: 220,
        purchasedAt: new Date(now.getTime() - 8 * 365 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      },
    ];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists tape inventory with computed health scores for ops", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "ops@biovault.test", password: PASSWORD });

    const res = await agent.get("/api/v1/admin/tapes");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.tapes[0]).toMatchObject({
      barcode: "LTO9-00042",
      rack: "R-A",
      slot: "S-12",
      fillPercent: 45,
      healthScore: "green",
    });
    expect(res.body.tapes[1].healthScore).toBe("red");
  });

  it("rejects tape inventory for client users", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });

    const res = await agent.get("/api/v1/admin/tapes");
    expect(res.status).toBe(403);
  });
});
