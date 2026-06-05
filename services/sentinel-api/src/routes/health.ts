import { Router } from "express";
import { config } from "../config.js";
import { mongoReady } from "../db/connect.js";
import { pingRedis } from "../redis.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const mongoUp = mongoReady();
  const redisUp = await pingRedis();
  const status = mongoUp && redisUp ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({
    status,
    version: config.version,
    dependencies: {
      mongodb: mongoUp ? "up" : "down",
      redis: redisUp ? "up" : "down",
    },
  });
});
