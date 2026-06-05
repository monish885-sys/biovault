import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mongooseMock = vi.hoisted(() => ({
  set: vi.fn(),
  connect: vi.fn().mockResolvedValue({}),
  disconnect: vi.fn().mockResolvedValue(undefined),
  connection: { readyState: 0 as number },
}));

vi.mock("mongoose", () => ({
  default: mongooseMock,
}));

import { connectMongo, disconnectMongo, mongoReady } from "./connect.js";

describe("connectMongo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mongooseMock.connection.readyState = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("connects with strictQuery and reports ready", async () => {
    mongooseMock.connection.readyState = 1;
    await connectMongo();
    expect(mongooseMock.set).toHaveBeenCalledWith("strictQuery", true);
    expect(mongooseMock.connect).toHaveBeenCalledWith("mongodb://localhost:27017/sentinel");
    expect(mongoReady()).toBe(true);
  });

  it("disconnects cleanly", async () => {
    await disconnectMongo();
    expect(mongooseMock.disconnect).toHaveBeenCalled();
  });
});
