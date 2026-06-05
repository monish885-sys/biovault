import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisInstance = vi.hoisted(() => ({
  on: vi.fn(),
  ping: vi.fn().mockResolvedValue("PONG"),
  quit: vi.fn().mockResolvedValue("OK"),
}));

vi.mock("ioredis", () => ({
  Redis: vi.fn(function RedisMock() {
    return redisInstance;
  }),
}));

import { closeRedis, getRedis, pingRedis } from "./redis.js";

describe("redis client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisInstance.ping.mockResolvedValue("PONG");
  });

  afterEach(async () => {
    await closeRedis();
  });

  it("returns a singleton and pings successfully", async () => {
    const a = getRedis();
    const b = getRedis();
    expect(a).toBe(b);
    expect(await pingRedis()).toBe(true);
    expect(redisInstance.ping).toHaveBeenCalled();
  });

  it("reports false when ping fails", async () => {
    redisInstance.ping.mockRejectedValueOnce(new Error("down"));
    expect(await pingRedis()).toBe(false);
  });

  it("closes the client on quit", async () => {
    getRedis();
    await closeRedis();
    expect(redisInstance.quit).toHaveBeenCalled();
  });
});
