import { Router } from "express";
import { searchClientFiles } from "./search.service.js";

export const searchRouter = Router();

searchRouter.get("/files", async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const result = await searchClientFiles(req.auth!.clientId!, {
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      fileType: typeof req.query.fileType === "string" ? req.query.fileType : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
