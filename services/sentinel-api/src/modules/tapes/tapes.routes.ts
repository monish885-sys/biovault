import { Router } from "express";
import { listTapes } from "./tapes.service.js";

export const tapesRouter = Router();

tapesRouter.get("/", async (_req, res, next) => {
  try {
    const result = await listTapes();
    res.json(result);
  } catch (err) {
    next(err);
  }
});
