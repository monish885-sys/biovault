import { Router } from "express";
import { requireAuth, requireClientUser, requireInternalUser, requireRoles } from "../middleware/auth.js";
import { auditRouter } from "../modules/audit/audit.routes.js";
import { clientAuditRouter } from "../modules/audit/client-audit.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { ROUTE_ROLES } from "../modules/auth/permissions.js";
import { certificatesRouter } from "../modules/certificates/certificates.routes.js";
import { clientsRouter } from "../modules/clients/clients.routes.js";
import { ingestRouter } from "../modules/ingest/ingest.routes.js";
import { adminJobsRouter } from "../modules/jobs/admin-jobs.routes.js";
import { retrievalDownloadHandler, retrievalRouter } from "../modules/retrieval/retrieval.routes.js";
import { tapesRouter } from "../modules/tapes/tapes.routes.js";
import { searchRouter } from "../modules/search/search.routes.js";
import { billingRouter } from "../modules/billing/billing.routes.js";
import { erasureRouter } from "../modules/erasure/erasure.routes.js";
import { adminErasureRouter } from "../modules/erasure/admin-erasure.routes.js";
import { demoRouter } from "../routes/demo.js";
export const apiV1Router = Router();

apiV1Router.use("/demo", demoRouter);
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/clients", clientsRouter);

apiV1Router.use(
  "/ingest",
  requireAuth,
  requireClientUser,
  ingestRouter,
  certificatesRouter,
);
apiV1Router.use(
  "/audit",
  requireAuth,
  requireClientUser,
  clientAuditRouter,
);
apiV1Router.use(
  "/search",
  requireAuth,
  requireClientUser,
  requireRoles(...ROUTE_ROLES.searchRead),
  searchRouter,
);
apiV1Router.use(
  "/retrieval",
  requireAuth,
  requireClientUser,
  retrievalRouter,
);
apiV1Router.get(
  "/retrieval/download",
  requireAuth,
  requireClientUser,
  requireRoles(...ROUTE_ROLES.retrievalDownload),
  retrievalDownloadHandler,
);
apiV1Router.use(
  "/billing",
  requireAuth,
  requireClientUser,
  billingRouter,
);
apiV1Router.use(
  "/erasure",
  requireAuth,
  requireClientUser,
  erasureRouter,
);

const adminRouter = Router();
adminRouter.use(requireAuth, requireInternalUser);
adminRouter.use("/jobs", requireRoles(...ROUTE_ROLES.adminOps), adminJobsRouter);
adminRouter.use("/tapes", requireRoles(...ROUTE_ROLES.adminOps), tapesRouter);
adminRouter.use("/erasure", requireRoles(...ROUTE_ROLES.adminOps), adminErasureRouter);
adminRouter.use("/audit", requireRoles(...ROUTE_ROLES.auditReadInternal), auditRouter);
apiV1Router.use("/admin", adminRouter);
