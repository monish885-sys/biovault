import { Router } from "express";
import { requireAuth, requireInternalUser, requireRoles } from "../middleware/auth.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { ROUTE_ROLES } from "../modules/auth/permissions.js";
import { clientsRouter } from "../modules/clients/clients.routes.js";
import { moduleStub } from "./stub.js";

export const apiV1Router = Router();

apiV1Router.use("/auth", authRouter);
apiV1Router.use("/clients", clientsRouter);

apiV1Router.use(
  "/ingest",
  requireAuth,
  requireRoles(...ROUTE_ROLES.ingestCreate),
  moduleStub("ingest", "Day 3–5"),
);
apiV1Router.use(
  "/search",
  requireAuth,
  requireRoles(...ROUTE_ROLES.searchRead),
  moduleStub("search", "Day 6"),
);
apiV1Router.use(
  "/retrieval",
  requireAuth,
  requireRoles(...ROUTE_ROLES.retrievalCreate),
  moduleStub("retrieval", "Day 7"),
);

const adminRouter = Router();
adminRouter.use(requireAuth, requireInternalUser);
adminRouter.use("/jobs", requireRoles(...ROUTE_ROLES.adminOps), moduleStub("admin jobs", "Day 8"));
adminRouter.use("/tapes", requireRoles(...ROUTE_ROLES.adminOps), moduleStub("admin tapes", "Day 10"));
apiV1Router.use("/admin", adminRouter);
