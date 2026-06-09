import { Router } from "express";
import { exportAuditTrail, listAuditEvents } from "./export.service.js";

export const auditRouter = Router();

auditRouter.get("/events", async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const result = await listAuditEvents({
      clientId: typeof req.query.clientId === "string" ? req.query.clientId : undefined,
      action: typeof req.query.action === "string" ? req.query.action : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

auditRouter.get("/export", async (req, res, next) => {
  try {
    const result = await exportAuditTrail({
      clientId: typeof req.query.clientId === "string" ? req.query.clientId : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
