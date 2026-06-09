import { Router } from "express";
import {
  completeRetrievalJob,
  updateAdminRetrievalJobStatus,
} from "../retrieval/retrieval-complete.js";
import { listAdminJobs } from "./admin-jobs.service.js";

export const adminJobsRouter = Router();

adminJobsRouter.get("/", async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const overdue =
      req.query.overdue === "true" || req.query.overdue === "1";

    const result = await listAdminJobs({
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      overdue: overdue || undefined,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

adminJobsRouter.patch("/:jobId", async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (typeof status !== "string" || !status.trim()) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "status is required" });
      return;
    }

    const result = await updateAdminRetrievalJobStatus(
      String(req.params.jobId),
      req.auth!.sub,
      status.trim(),
      req.ip,
    );
    res.json({ job: result });
  } catch (err) {
    next(err);
  }
});

adminJobsRouter.post("/:jobId/complete", async (req, res, next) => {
  try {
    const result = await completeRetrievalJob(
      String(req.params.jobId),
      req.auth!.sub,
      req.ip,
    );
    res.json({ job: result });
  } catch (err) {
    next(err);
  }
});
