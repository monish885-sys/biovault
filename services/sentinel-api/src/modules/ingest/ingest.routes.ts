import { Router } from "express";
import { requireRoles } from "../../middleware/auth.js";
import { ROUTE_ROLES } from "../auth/permissions.js";
import {
  createIngestJobFromUpload,
  getIngestJobForClient,
  getIngestReportForClient,
} from "./ingest.service.js";

export const ingestRouter = Router();

ingestRouter.post("/jobs", requireRoles(...ROUTE_ROLES.ingestCreate), async (req, res, next) => {
  try {
    const job = await createIngestJobFromUpload(
      req.auth!.clientId!,
      req.auth!.sub,
      req,
      req.ip,
    );
    res.status(201).json({ job });
  } catch (err) {
    next(err);
  }
});

ingestRouter.get("/jobs/:jobId/report", requireRoles(...ROUTE_ROLES.ingestRead), async (req, res, next) => {
  try {
    const jobId = String(req.params.jobId);
    const report = await getIngestReportForClient(req.auth!.clientId!, jobId);
    res.json({ report });
  } catch (err) {
    next(err);
  }
});

ingestRouter.get("/jobs/:jobId", requireRoles(...ROUTE_ROLES.ingestRead), async (req, res, next) => {
  try {
    const jobId = String(req.params.jobId);
    const job = await getIngestJobForClient(req.auth!.clientId!, jobId);
    res.json({ job });
  } catch (err) {
    next(err);
  }
});
