import { defineConfig, devices } from "@playwright/test";

/** Playwright config for recording the TerraVault product demo video (1920×1080). */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "demo-video.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  reporter: [["list"]],
  outputDir: "docs/gtm/demo-video/.playwright-output",
  use: {
    baseURL: process.env.DEMO_URL ?? "http://localhost:8080",
    trace: "off",
    screenshot: "off",
    video: {
      mode: "on",
      size: { width: 1920, height: 1080 },
    },
    viewport: { width: 1920, height: 1080 },
    launchOptions: {
      slowMo: 120,
    },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    expect: { timeout: 20_000 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
