import type { RequestHandler } from "express";
import { CORRELATION_HEADER, resolveCorrelationId } from "@biovault/common";

export const correlationMiddleware: RequestHandler = (req, res, next) => {
  const id = resolveCorrelationId(req.headers[CORRELATION_HEADER] as string | undefined);
  req.correlationId = id;
  res.setHeader(CORRELATION_HEADER, id);
  next();
};

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}
