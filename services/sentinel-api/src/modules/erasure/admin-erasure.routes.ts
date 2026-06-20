import { Router } from "express";
import { requireRoles } from "../../middleware/auth.js";
import { ROUTE_ROLES } from "../auth/permissions.js";
import {
  completeErasureRequest,
  getErasureRequestAdmin,
  listErasureRequestsAdmin,
} from "../erasure/erasure.service.js";

export const adminErasureRouter = Router();

adminErasureRouter.get(
  "/requests",
  requireRoles(...ROUTE_ROLES.adminOps),
  async (_req, res, next) => {
    try {
      const requests = await listErasureRequestsAdmin();
      res.json({ requests, total: requests.length });
    } catch (err) {
      next(err);
    }
  },
);

adminErasureRouter.get(
  "/requests/:requestId",
  requireRoles(...ROUTE_ROLES.adminOps),
  async (req, res, next) => {
    try {
      const request = await getErasureRequestAdmin(String(req.params.requestId));
      res.json({ request });
    } catch (err) {
      next(err);
    }
  },
);

adminErasureRouter.post(
  "/requests/:requestId/complete",
  requireRoles(...ROUTE_ROLES.adminOps),
  async (req, res, next) => {
    try {
      const { degaussMethod, notes } = req.body as {
        degaussMethod?: string;
        notes?: string;
      };
      const request = await completeErasureRequest(
        String(req.params.requestId),
        req.auth!.sub,
        { degaussMethod: degaussMethod ?? "degauss", notes },
        req.ip,
      );
      res.json({ request });
    } catch (err) {
      next(err);
    }
  },
);
