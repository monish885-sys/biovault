import { Router } from "express";
import { requireRoles } from "../../middleware/auth.js";
import { ROUTE_ROLES } from "../auth/permissions.js";
import { getBillingSummary, getInvoicePreview } from "./billing.service.js";

export const billingRouter = Router();

billingRouter.get(
  "/summary",
  requireRoles(...ROUTE_ROLES.billingRead),
  async (req, res, next) => {
    try {
      const summary = await getBillingSummary(req.auth!.clientId!);
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  },
);

billingRouter.get(
  "/invoice",
  requireRoles(...ROUTE_ROLES.billingRead),
  async (req, res, next) => {
    try {
      const invoice = await getInvoicePreview(req.auth!.clientId!);
      res.json({ invoice });
    } catch (err) {
      next(err);
    }
  },
);
