import { Router } from "express";
import { config } from "../config.js";

export const demoRouter = Router();

demoRouter.get("/info", (_req, res) => {
  res.json({
    demoMode: config.demoMode,
    publicUrl: config.publicUrl || undefined,
    version: config.version,
    tapeAdapter: config.tapeAdapter,
    credentials: config.demoMode
      ? {
          client: { email: "admin@acme.test", password: "ChangeMe123!" },
          admin: { email: "tech@biovault.test", password: "ChangeMe123!" },
        }
      : undefined,
  });
});
