import { Router } from "express";
import { requireRoles } from "../../middleware/auth.js";
import { ROUTE_ROLES } from "../auth/permissions.js";
import { exportAuditTrail } from "./export.service.js";

export const clientAuditRouter = Router();

clientAuditRouter.get(
  "/export",
  requireRoles(...ROUTE_ROLES.auditExportClient),
  async (req, res, next) => {
    try {
      const result = await exportAuditTrail({
        clientId: req.auth!.clientId!,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
