import { Router } from "express";
import { requireAuth, requireClientUser, requireRoles } from "../../middleware/auth.js";
import { ROUTE_ROLES } from "../auth/permissions.js";
import { getClientProfile, updateOnboardingStub } from "./clients.service.js";

export const clientsRouter = Router();

clientsRouter.use(requireAuth, requireClientUser);

clientsRouter.get("/me", requireRoles(...ROUTE_ROLES.clientProfile), async (req, res, next) => {
  try {
    const profile = await getClientProfile(req.auth!.clientId!);
    res.json({ client: profile });
  } catch (err) {
    next(err);
  }
});

clientsRouter.patch(
  "/me/onboarding",
  requireRoles(...ROUTE_ROLES.clientOnboarding),
  async (req, res, next) => {
    try {
      const clientId = req.auth!.clientId!;
      const profile = await updateOnboardingStub(
        clientId,
        req.auth!.sub,
        req.body as { dataCategories?: string[]; retentionPolicyYears?: number },
        req.ip,
      );
      res.json({ client: profile });
    } catch (err) {
      next(err);
    }
  },
);
