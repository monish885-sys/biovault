import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("suppresses debug when min level is info", () => {
    const log = createLogger("test-svc", "info");
    log.debug("hidden");
    log.info("visible");
    expect(console.log).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(vi.mocked(console.log).mock.calls[0]?.[0]));
    expect(line.service).toBe("test-svc");
    expect(line.msg).toBe("visible");
  });

  it("writes errors to console.error", () => {
    const log = createLogger("test-svc", "error");
    log.error("failed", { correlationId: "cid-1" });
    expect(console.error).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(vi.mocked(console.error).mock.calls[0]?.[0]));
    expect(line.level).toBe("error");
    expect(line.correlationId).toBe("cid-1");
  });
});
