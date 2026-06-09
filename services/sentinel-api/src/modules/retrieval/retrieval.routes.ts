import { pipeline } from "node:stream/promises";
import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  fulfillRetrievalDownload,
  purgeRetrievalAfterDownload,
} from "./retrieval-download.js";
import {
  createRetrievalJob,
  getRetrievalJobForClient,
  listRetrievalJobsForClient,
} from "./retrieval.service.js";

export async function retrievalDownloadHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.query.token;
    if (typeof token !== "string" || !token.trim()) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "token is required" });
      return;
    }

    const result = await fulfillRetrievalDownload(token.trim(), req.ip);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);

    result.stream.on("error", (err) => next(err));
    res.on("close", () => {
      if (!res.writableFinished) result.stream.destroy();
    });

    try {
      await pipeline(result.stream, res, { end: false });
    } finally {
      result.stream.destroy();
      await purgeRetrievalAfterDownload(result.retrievalJobId, result.clientId, req.ip);
      if (!res.writableEnded) res.end();
    }
  } catch (err) {
    next(err);
  }
}

export const retrievalRouter = Router();

retrievalRouter.post("/jobs", async (req, res, next) => {
  try {
    const fileId = req.body?.fileId;
    if (typeof fileId !== "string" || !fileId.trim()) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "fileId is required" });
      return;
    }

    const job = await createRetrievalJob(
      req.auth!.clientId!,
      req.auth!.sub,
      fileId.trim(),
      req.ip,
    );
    res.status(201).json({ job });
  } catch (err) {
    next(err);
  }
});

retrievalRouter.get("/jobs", async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const result = await listRetrievalJobsForClient(req.auth!.clientId!, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

retrievalRouter.get("/jobs/:jobId", async (req, res, next) => {
  try {
    const job = await getRetrievalJobForClient(req.auth!.clientId!, String(req.params.jobId));
    res.json({ job });
  } catch (err) {
    next(err);
  }
});
