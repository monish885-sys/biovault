import { describe, expect, it } from "vitest";
import { resolveCorrelationId } from "./correlation-id.js";

describe("resolveCorrelationId", () => {
  it("uses header when present", () => {
    expect(resolveCorrelationId("abc-123")).toBe("abc-123");
  });

  it("generates id when missing", () => {
    const id = resolveCorrelationId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
