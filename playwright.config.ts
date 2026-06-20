import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 120_000,
  use: {
    baseURL: process.env.CLIENT_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "pnpm dev:api",
          url: "http://localhost:4000/health",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            SESSION_SECRET: "e2e-session-secret",
            SEARCH_TOKEN_SECRET: "e2e-search-secret",
            DOWNLOAD_TOKEN_SECRET: "e2e-download-secret",
            STAGING_PATH: "./staging-e2e",
            MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://localhost:27017/sentinel-e2e",
            REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
          },
        },
        {
          command: "pnpm dev:client",
          url: "http://localhost:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          command: "pnpm dev:admin",
          url: "http://localhost:5174",
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});
