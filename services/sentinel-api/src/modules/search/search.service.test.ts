import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Types } from "mongoose";
import { buildFilenameSearchTokens } from "../../search/filename-tokens.js";

const CLIENT_ID = "507f1f77bcf86cd799439011";

const store = vi.hoisted(() => ({
  files: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../db/schemas/file.js", () => ({
  FileModel: {
    find: vi.fn((filter: Record<string, unknown>) => {
      const matched = store.files.filter((file) => {
        if (String(filter.clientId) !== String(file.clientId)) return false;
        if (filter.status && file.status !== filter.status) return false;
        return true;
      });
      return {
        sort: vi.fn(() => ({
          skip: vi.fn(() => ({
            limit: vi.fn(() => ({
              select: vi.fn(() => ({
                lean: vi.fn(async () => matched),
              })),
            })),
          })),
        })),
      };
    }),
    countDocuments: vi.fn(async (filter: Record<string, unknown>) =>
      store.files.filter((file) => String(filter.clientId) === String(file.clientId)).length,
    ),
  },
}));

import { searchClientFiles } from "./search.service.js";

describe("searchClientFiles", () => {
  beforeEach(() => {
    vi.stubEnv("SEARCH_TOKEN_SECRET", "unit-test-search-secret");
    store.files = [
      {
        _id: new Types.ObjectId(),
        clientId: new Types.ObjectId(CLIENT_ID),
        filename: "lab-result.csv",
        filenameSearchTokens: buildFilenameSearchTokens("lab-result.csv", CLIENT_ID),
        keywordSearchTokens: [],
        fileType: "csv",
        category: "lab",
        status: "on_tape",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("scopes results to clientId and on_tape status", async () => {
    const result = await searchClientFiles(CLIENT_ID, {});
    expect(result.total).toBe(1);
    expect(result.files[0]?.filename).toBe("lab-result.csv");
    expect(result.files[0]).not.toHaveProperty("tapeBarcode");
  });
});
