import { describe, expect, it } from "vitest";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./errors.js";

describe("AppError hierarchy", () => {
  it("maps NotFoundError to 404", () => {
    const err = new NotFoundError("missing tape");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("missing tape");
  });

  it("maps auth errors to 401 and 403", () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it("maps ValidationError to 400", () => {
    const err = new ValidationError("bad payload");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("defaults AppError to 500", () => {
    const err = new AppError("boom");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
  });
});
