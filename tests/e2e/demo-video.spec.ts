import { test, expect, type Page } from "@playwright/test";

const CLIENT_EMAIL = "admin@acme.test";
const CLIENT_PASSWORD = "ChangeMe123!";
const ADMIN_EMAIL = "tech@biovault.test";
const DEMO_FILENAME = "mri-brain-patient-0312.dcm";
const SEARCH_TERM = "0312";

/** Pacing for screen recording — readable on LinkedIn without voiceover. */
async function beat(page: Page, ms = 1800): Promise<void> {
  await page.waitForTimeout(ms);
}

async function signInClient(page: Page): Promise<void> {
  await page.goto("/client/");
  await expect(page.getByRole("heading", { name: "Hospital Archive Portal" })).toBeVisible();
  await beat(page, 1200);
  await page.getByLabel("Email").fill(CLIENT_EMAIL);
  await page.getByLabel("Password").fill(CLIENT_PASSWORD);
  await beat(page, 600);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Overview" })).toBeVisible({ timeout: 15_000 });
  await beat(page);
}

async function signInAdmin(page: Page): Promise<void> {
  await page.goto("/admin/");
  await expect(page.getByRole("heading", { name: "Vault Operations Portal" })).toBeVisible();
  await beat(page, 1200);
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(CLIENT_PASSWORD);
  await beat(page, 600);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Retrieval queue" })).toBeVisible({
    timeout: 15_000,
  });
  await beat(page);
}

test.describe("TerraVault product demo video", () => {
  test.beforeAll(async () => {
    const base = process.env.DEMO_URL ?? "http://localhost:8080";
    const health = await fetch(`${base}/health`);
    if (!health.ok) {
      throw new Error(
        `Demo stack not running at ${base} — run: pnpm demo:record (or bash scripts/record-demo-video.sh)`,
      );
    }
  });

  test("record full product walkthrough", async ({ page, context }) => {
  // ── 1. Landing page ──────────────────────────────────────────────
  await page.goto("/");
  await expect(page.getByText("TerraVault").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/offline and under control/i)).toBeVisible();
  await beat(page, 2500);
  await page.evaluate(() => window.scrollBy(0, 400));
  await beat(page, 2000);

  // ── 2. Client portal — overview ──────────────────────────────────
  await signInClient(page);
  await expect(page.getByText("Secure medical archive")).toBeVisible({ timeout: 10_000 });
  await beat(page, 2200);

  // ── 3. Search & request retrieval ────────────────────────────────
  await page.getByRole("button", { name: "Search archive" }).first().click();
  await beat(page, 800);
  await page.getByPlaceholder("Filename or keyword").fill(SEARCH_TERM);
  await beat(page, 600);
  await page.locator("form").getByRole("button", { name: "Search archive" }).click();
  await expect(page.getByText(DEMO_FILENAME)).toBeVisible({ timeout: 15_000 });
  await beat(page, 1500);

  const requestBtn = page
    .locator("article")
    .filter({ hasText: DEMO_FILENAME })
    .getByRole("button", { name: "Request file" });
  await requestBtn.click();
  await expect(page.getByText(/request sent|track progress/i)).toBeVisible({ timeout: 10_000 });
  await beat(page, 1800);

  // ── 4. Client retrieval tracker ──────────────────────────────────
  await page.getByRole("button", { name: "Retrieval jobs" }).click();
  await expect(page.getByText(DEMO_FILENAME)).toBeVisible({ timeout: 10_000 });
  await beat(page, 2000);

  // ── 5. Operations — fulfil retrieval ─────────────────────────────
  const adminPage = await context.newPage();
  await signInAdmin(adminPage);
  await expect(adminPage.getByText(DEMO_FILENAME)).toBeVisible({ timeout: 15_000 });
  await beat(adminPage, 1200);

  const jobCard = adminPage.locator("article").filter({ hasText: DEMO_FILENAME });
  const assignBtn = jobCard.getByRole("button", { name: "Assign to me" });
  if (await assignBtn.isVisible()) {
    await assignBtn.click();
    await beat(adminPage, 1000);
  }
  const startBtn = jobCard.getByRole("button", { name: "Start retrieval" });
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await beat(adminPage, 1000);
  }
  await jobCard.getByRole("button", { name: "Complete & stage for client" }).click();
  await beat(adminPage, 1500);

  // ── 6. Client download ───────────────────────────────────────────
  await page.getByRole("button", { name: "Retrieval jobs" }).click();
  const downloadBtn = page.getByRole("button", { name: /Download file/i });
  await expect(downloadBtn).toBeVisible({ timeout: 20_000 });
  await beat(page, 1200);
  await downloadBtn.click();
  await beat(page, 2000);

  // ── 7. Compliance (DPDPA erasure) ────────────────────────────────
  await page.getByRole("button", { name: "Compliance" }).click();
  await expect(page.getByText(/erasure|DPDPA|awaiting/i).first()).toBeVisible({ timeout: 10_000 });
  await beat(page, 2200);

  await adminPage.getByRole("button", { name: "Erasure queue" }).click();
  await expect(adminPage.getByText(/SUBJ-DPDPA|patient 0042/i).first()).toBeVisible({
    timeout: 10_000,
  });
  await beat(adminPage, 2000);

  // ── 8. Tape inventory ────────────────────────────────────────────
  await adminPage.getByRole("button", { name: "Tape inventory" }).click();
  await expect(adminPage.getByText(/TAPE-ACME/i).first()).toBeVisible({ timeout: 10_000 });
  await beat(adminPage, 2000);

  // ── 9. Billing ───────────────────────────────────────────────────
  await page.getByRole("button", { name: "Billing" }).click();
  await expect(page.getByText("Storage used")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/cloud|savings/i).first()).toBeVisible();
  await beat(page, 2200);

  // ── 10. Close on landing + pilot CTA ─────────────────────────────
  await adminPage.close();
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByText(/Hyderabad pilot/i)).toBeVisible();
  await beat(page, 3000);
  });
});
