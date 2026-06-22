import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const userStore = vi.hoisted(() => ({
  clientAdmin: {
    _id: "507f1f77bcf86cd799439012",
    email: "admin@acme.test",
    passwordHash: "",
    role: "client_admin",
    clientId: "507f1f77bcf86cd799439011",
    mfaEnabled: false,
    active: true,
  },
  viewer: {
    _id: "507f1f77bcf86cd799439013",
    email: "viewer@acme.test",
    passwordHash: "",
    role: "client_viewer",
    clientId: "507f1f77bcf86cd799439011",
    mfaEnabled: false,
    active: true,
  },
  ops: {
    _id: "507f1f77bcf86cd799439014",
    email: "ops@biovault.test",
    passwordHash: "",
    role: "ops_admin",
    mfaEnabled: false,
    active: true,
  },
}));

vi.mock("../../db/schemas/user.js", () => ({
  UserModel: {
    findOne: vi.fn((query: { email: string }) => ({
      lean: vi.fn(async () => {
        const all = [userStore.clientAdmin, userStore.viewer, userStore.ops];
        return all.find((u) => u.email === query.email) ?? null;
      }),
    })),
    findById: vi.fn((id: string) => ({
      lean: vi.fn(async () => {
        const all = [userStore.clientAdmin, userStore.viewer, userStore.ops];
        return all.find((u) => String(u._id) === String(id)) ?? null;
      }),
    })),
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => []),
      })),
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
        _id: "507f1f77bcf86cd799439011",
        name: "Acme Hospital",
        slug: "acme",
        tier: "standard",
        retentionPolicyYears: 7,
        dataCategories: ["imaging"],
        onboardingComplete: false,
        active: true,
      })),
    })),
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => []),
      })),
    })),
    findOneAndUpdate: vi.fn(() => ({
      lean: vi.fn(async () => ({
        _id: "507f1f77bcf86cd799439011",
        name: "Acme Hospital",
        slug: "acme",
        tier: "standard",
        retentionPolicyYears: 10,
        dataCategories: ["imaging", "lab_reports"],
        onboardingComplete: true,
        active: true,
      })),
    })),
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

vi.mock("../../db/schemas/file.js", () => ({
  FileModel: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        skip: vi.fn(() => ({
          limit: vi.fn(() => ({
            select: vi.fn(() => ({
              lean: vi.fn(async () => []),
            })),
          })),
        })),
      })),
      select: vi.fn(() => ({
        lean: vi.fn(async () => []),
      })),
    })),
    countDocuments: vi.fn(async () => 0),
  },
}));

vi.mock("../../db/schemas/retrieval-job.js", () => ({
  RetrievalJobModel: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        skip: vi.fn(() => ({
          limit: vi.fn(() => ({
            lean: vi.fn(async () => []),
          })),
        })),
      })),
    })),
    countDocuments: vi.fn(async () => 0),
  },
}));

vi.mock("../../db/schemas/file-location.js", () => ({
  FileLocationModel: {
    find: vi.fn(async () => []),
  },
}));

vi.mock("../../db/schemas/tape.js", () => ({
  TapeModel: {
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => []),
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

describe("auth + RBAC integration", () => {
  beforeEach(async () => {
    vi.stubEnv("SESSION_SECRET", "integration-test-secret");
    const hash = await bcrypt.hash(PASSWORD, 4);
    userStore.clientAdmin.passwordHash = hash;
    userStore.viewer.passwordHash = hash;
    userStore.ops.passwordHash = hash;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated protected routes", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/search/files");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  it("logs in and returns session cookie", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@acme.test", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("client_admin");
    expect(res.headers["set-cookie"]?.join(";")).toContain("sentinel_session_client");
  });

  it("allows client_admin through RBAC to search archived files", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });
    const res = await agent.get("/api/v1/search/files");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("files");
    expect(res.body).toHaveProperty("total");
  });

  it("blocks client_viewer from ingest (admin-only)", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "viewer@acme.test", password: PASSWORD });
    const res = await agent.post("/api/v1/ingest/jobs");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("allows ops_admin to list admin jobs", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "ops@biovault.test", password: PASSWORD });
    const res = await agent.get("/api/v1/admin/jobs");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("jobs");
    expect(res.body).toHaveProperty("total");
  });

  it("blocks client from admin routes", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });
    const res = await agent.get("/api/v1/admin/jobs");
    expect(res.status).toBe(403);
  });

  it("returns client profile and updates onboarding", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });
    const profile = await agent.get("/api/v1/clients/me");
    expect(profile.status).toBe(200);
    expect(profile.body.client.slug).toBe("acme");

    const patch = await agent
      .patch("/api/v1/clients/me/onboarding")
      .send({ retentionPolicyYears: 10, dataCategories: ["imaging", "lab_reports"] });
    expect(patch.status).toBe(200);
    expect(patch.body.client.onboardingComplete).toBe(true);
  });

  it("logs out and clears session", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: "admin@acme.test", password: PASSWORD });
    const logout = await agent.post("/api/v1/auth/logout");
    expect(logout.status).toBe(204);
    const me = await agent.get("/api/v1/auth/me");
    expect(me.status).toBe(401);
  });
});
