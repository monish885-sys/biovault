import { Router } from "express";
import { requireRoles } from "../../middleware/auth.js";
import { ROUTE_ROLES } from "../auth/permissions.js";
import {
  issueIngestCertificate,
  getIngestCertificateForClient,
  readIngestCertificatePdfForClient,
} from "./certificates.service.js";

export const certificatesRouter = Router();

certificatesRouter.get(
  "/jobs/:jobId/certificate",
  requireRoles(...ROUTE_ROLES.ingestRead),
  async (req, res, next) => {
    try {
      const jobId = String(req.params.jobId);
      const cert = await getIngestCertificateForClient(req.auth!.clientId!, jobId);
      if (!cert) {
        res.status(404).json({ error: "NOT_FOUND", message: "Certificate not found for this job" });
        return;
      }
      res.json({ certificate: cert });
    } catch (err) {
      next(err);
    }
  },
);

certificatesRouter.post(
  "/jobs/:jobId/certificate",
  requireRoles(...ROUTE_ROLES.ingestRead),
  async (req, res, next) => {
    try {
      const jobId = String(req.params.jobId);
      const cert = await issueIngestCertificate(
        req.auth!.clientId!,
        jobId,
        req.auth!.sub,
        req.ip,
      );
      res.status(201).json({ certificate: cert });
    } catch (err) {
      next(err);
    }
  },
);

certificatesRouter.get(
  "/jobs/:jobId/certificate/download",
  requireRoles(...ROUTE_ROLES.ingestRead),
  async (req, res, next) => {
    try {
      const jobId = String(req.params.jobId);
      const { buffer, filename } = await readIngestCertificatePdfForClient(
        req.auth!.clientId!,
        jobId,
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);
