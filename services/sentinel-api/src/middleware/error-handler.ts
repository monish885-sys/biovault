import type { ErrorRequestHandler } from "express";
import { AppError, createLogger } from "@biovault/common";
import { config } from "../config.js";

const log = createLogger("http", config.logLevel);

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const correlationId = req.correlationId;
  if (err instanceof AppError) {
    log.warn(err.message, { correlationId, code: err.code });
    res.status(err.statusCode).json({ error: err.code, message: err.message, correlationId });
    return;
  }
  log.error("unhandled", { correlationId, err: String(err) });
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: config.nodeEnv === "production" ? "Internal server error" : String(err),
    correlationId,
  });
};
