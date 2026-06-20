import { Router } from "express";
import { requireRoles } from "../../middleware/auth.js";
import { ROUTE_ROLES } from "../auth/permissions.js";
import {
  createErasureRequest,
  getErasureRequestForClient,
  listErasureRequestsForClient,
} from "./erasure.service.js";
import {
  readDeletionCertificatePdf,
} from "../certificates/certificates.service.js";

export const erasureRouter = Router();

erasureRouter.post(
  "/requests",
  requireRoles(...ROUTE_ROLES.erasureCreate),
  async (req, res, next) => {
    try {
      const { subjectId, reason, searchQuery } = req.body as {
        subjectId?: string;
        reason?: string;
        searchQuery?: string;
      };
      if (!subjectId?.trim() || !reason?.trim() || !searchQuery?.trim()) {
        res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "subjectId, reason, and searchQuery are required",
        });
        return;
      }
      const request = await createErasureRequest(
        req.auth!.clientId!,
        req.auth!.sub,
        { subjectId, reason, searchQuery },
        req.ip,
      );
      res.status(201).json({ request });
    } catch (err) {
      next(err);
    }
  },
);

erasureRouter.get(
  "/requests",
  requireRoles(...ROUTE_ROLES.erasureRead),
  async (req, res, next) => {
    try {
      const requests = await listErasureRequestsForClient(req.auth!.clientId!);
      res.json({ requests, total: requests.length });
    } catch (err) {
      next(err);
    }
  },
);

erasureRouter.get(
  "/requests/:requestId",
  requireRoles(...ROUTE_ROLES.erasureRead),
  async (req, res, next) => {
    try {
      const request = await getErasureRequestForClient(
        req.auth!.clientId!,
        String(req.params.requestId),
      );
      res.json({ request });
    } catch (err) {
      next(err);
    }
  },
);

erasureRouter.get(
  "/requests/:requestId/certificate/download",
  requireRoles(...ROUTE_ROLES.erasureRead),
  async (req, res, next) => {
    try {
      const request = await getErasureRequestForClient(
        req.auth!.clientId!,
        String(req.params.requestId),
      );
      if (!request.certificateId) {
        res.status(404).json({ error: "NOT_FOUND", message: "Certificate not yet issued" });
        return;
      }
      const { buffer, filename } = await readDeletionCertificatePdf(
        req.auth!.clientId!,
        request.certificateId,
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);
