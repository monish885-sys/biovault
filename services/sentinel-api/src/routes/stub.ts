import { Router, type RequestHandler } from "express";

export function moduleStub(moduleName: string, sprintHint: string): RequestHandler {
  const r = Router();
  r.all("{*path}", (_req, res) => {
    res.status(501).json({
      error: "NOT_IMPLEMENTED",
      message: `${moduleName} module — ${sprintHint}`,
    });
  });
  return r;
}
