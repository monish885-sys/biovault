import { Router } from "express";
import { requireAuth, requireClientUser, requireInternalUser, requireRoles } from "../middleware/auth.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { ROUTE_ROLES } from "../modules/auth/permissions.js";
import { clientsRouter } from "../modules/clients/clients.routes.js";
import { ingestRouter } from "../modules/ingest/ingest.routes.js";
import { adminJobsRouter } from "../modules/jobs/admin-jobs.routes.js";
import { retrievalDownloadHandler, retrievalRouter } from "../modules/retrieval/retrieval.routes.js";
import { tapesRouter } from "../modules/tapes/tapes.routes.js";
import { searchRouter } from "../modules/search/search.routes.js";
export const apiV1Router = Router();

apiV1Router.use("/auth", authRouter);
apiV1Router.use("/clients", clientsRouter);

apiV1Router.use(
  "/ingest",
  requireAuth,
  requireClientUser,
  ingestRouter,
);
apiV1Router.use(
  "/search",
  requireAuth,
  requireClientUser,
  requireRoles(...ROUTE_ROLES.searchRead),
  searchRouter,
);
apiV1Router.get("/retrieval/download", retrievalDownloadHandler);
apiV1Router.use(
  "/retrieval",
  requireAuth,
  requireClientUser,
  requireRoles(...ROUTE_ROLES.retrievalCreate),
  retrievalRouter,
);

const adminRouter = Router();
adminRouter.use(requireAuth, requireInternalUser);
adminRouter.use("/jobs", requireRoles(...ROUTE_ROLES.adminOps), adminJobsRouter);
adminRouter.use("/tapes", requireRoles(...ROUTE_ROLES.adminOps), tapesRouter);
apiV1Router.use("/admin", adminRouter);
