import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../../middleware/auth.js";
import { login, logout, resolveSessionUser } from "./auth.service.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "RATE_LIMITED", message: "Too many login attempts" },
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      const user = await login(String(email ?? ""), String(password ?? ""), res, req.ip);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await logout(req.auth?.sub, req.auth?.clientId, req.auth?.role, res, req.ip);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await resolveSessionUser(req.auth!);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
