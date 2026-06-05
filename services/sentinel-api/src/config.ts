function env(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env: ${key}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? "4000"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  version: process.env.APP_VERSION ?? "0.1.0-mvp",
  mongoUri: env("MONGODB_URI", "mongodb://localhost:27017/sentinel"),
  redisUrl: env("REDIS_URL", "redis://localhost:6379"),
  stagingPath: env("STAGING_PATH", "./staging"),
  tapeAdapter: (process.env.TAPE_ADAPTER ?? "sim") as "sim" | "mtx" | "scalar",
  sessionSecret: env("SESSION_SECRET", "dev-only-change-in-production"),
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? "28800"),
  logLevel: (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((s) => s.trim()),
};
