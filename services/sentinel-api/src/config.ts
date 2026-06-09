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
  searchTokenSecret: env("SEARCH_TOKEN_SECRET", "dev-only-search-token-secret"),
  downloadTokenSecret: env("DOWNLOAD_TOKEN_SECRET", "dev-only-download-token-secret"),
  downloadTtlSeconds: Number(process.env.DOWNLOAD_TTL_SECONDS ?? "3600"),
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? "28800"),
  logLevel: (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((s) => s.trim()),
  certSigningKeyPath: process.env.CERT_SIGNING_KEY_PATH,
};
