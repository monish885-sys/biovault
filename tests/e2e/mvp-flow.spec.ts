import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const API = process.env.API_URL ?? "http://localhost:4000";
const FIXTURE_DIR = join(import.meta.dirname, "fixtures");
const FIXTURE_PATH = join(FIXTURE_DIR, "demo-file.bin");

function ensureFixture(): Buffer {
  if (!existsSync(FIXTURE_DIR)) mkdirSync(FIXTURE_DIR, { recursive: true });
  if (!existsSync(FIXTURE_PATH)) {
    const buf = Buffer.alloc(64 * 1024, 0xab);
    writeFileSync(FIXTURE_PATH, buf);
  }
  return readFileSync(FIXTURE_PATH);
}

async function apiLogin(
  request: import("@playwright/test").APIRequestContext,
  email: string,
): Promise<string> {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password: "ChangeMe123!" },
  });
  expect(res.ok()).toBeTruthy();
  const cookies = res.headers()["set-cookie"];
  expect(cookies).toBeTruthy();
  return Array.isArray(cookies) ? cookies.join("; ") : cookies!;
}

async function pollIngestSealed(
  request: import("@playwright/test").APIRequestContext,
  cookie: string,
  jobId: string,
): Promise<void> {
  for (let i = 0; i < 45; i++) {
    const res = await request.get(`${API}/api/v1/ingest/jobs/${jobId}`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    if (body.job?.status === "sealed") return;
    if (body.job?.status === "failed") throw new Error("Ingest failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Ingest seal timeout");
}

test.describe("MVP end-to-end flow", () => {
  test.beforeAll(async () => {
    const health = await fetch(`${API}/health`);
    if (!health.ok) {
      test.skip(true, "API not running — start stack before E2E");
    }
  });

  test("full ingest → retrieval → download → audit loop", async ({
    page,
    request,
    context,
  }) => {
    const fixture = ensureFixture();
    const clientCookie = await apiLogin(request, "admin@acme.test");

    // Ingest via API (multipart)
    const boundary = "----BioVaultE2E";
    const filename = `e2e-scan-${Date.now()}.dcm`;
    const bodyParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nimaging\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      fixture,
      `\r\n--${boundary}--\r\n`,
    ];
    const body = Buffer.concat(
      bodyParts.map((p) => (typeof p === "string" ? Buffer.from(p) : p)),
    );

    const ingestRes = await request.post(`${API}/api/v1/ingest/jobs`, {
      headers: {
        Cookie: clientCookie,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      data: body,
    });
    expect(ingestRes.ok()).toBeTruthy();
    const ingest = await ingestRes.json();
    const jobId = ingest.job.id as string;

    await pollIngestSealed(request, clientCookie, jobId);

    // Certificate
    const certRes = await request.get(
      `${API}/api/v1/ingest/jobs/${jobId}/certificate`,
      { headers: { Cookie: clientCookie } },
    );
    expect(certRes.ok()).toBeTruthy();

    // Client portal: login + search
    await page.goto("/");
    await page.getByLabel("Email").fill("admin@acme.test");
    await page.getByLabel("Password").fill("ChangeMe123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Client Portal")).toBeVisible();

    const searchTerm = filename.replace(".dcm", "").slice(0, 12);
    await page.getByPlaceholder("Filename or keyword").fill(searchTerm);
    await page.getByRole("button", { name: "Search archive" }).click();
    await expect(page.getByText(filename)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Request file" }).click();
    await page.getByRole("button", { name: "Retrieval jobs" }).click();
    await expect(page.getByText(/pending|assigned|in progress|ready/i)).toBeVisible({
      timeout: 10_000,
    });

    // Admin portal: complete retrieval
    const adminPage = await context.newPage();
    await adminPage.goto(process.env.ADMIN_URL ?? "http://localhost:5174");
    await adminPage.getByLabel("Email").fill("tech@biovault.test");
    await adminPage.getByLabel("Password").fill("ChangeMe123!");
    await adminPage.getByRole("button", { name: "Sign in" }).click();
    await expect(adminPage.getByText("Sentinel Admin Portal")).toBeVisible();

    await expect(adminPage.getByText(filename)).toBeVisible({ timeout: 15_000 });

    const assignBtn = adminPage.getByRole("button", { name: "Assign" }).first();
    if (await assignBtn.isVisible()) await assignBtn.click();
    const startBtn = adminPage.getByRole("button", { name: "Start" }).first();
    if (await startBtn.isVisible()) await startBtn.click();
    await adminPage.getByRole("button", { name: /Complete.*stage for client/i }).first().click();

    // Client download (authenticated — not via admin link)
    await page.getByRole("button", { name: "Retrieval jobs" }).click();
    const downloadBtn = page.getByRole("button", { name: /Download file/i });
    await expect(downloadBtn).toBeVisible({ timeout: 15_000 });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadBtn.click(),
    ]);
    const path = await download.path();
    expect(path).toBeTruthy();
    const downloaded = readFileSync(path!);
    expect(createHash("sha256").update(downloaded).digest("hex")).toBe(
      createHash("sha256").update(fixture).digest("hex"),
    );

    // Billing tab (Day 15)
    await page.getByRole("button", { name: "Billing" }).click();
    await expect(page.getByText("Storage used")).toBeVisible();
    await expect(page.getByText("Invoice preview")).toBeVisible();

    // Compliance + erasure (Day 16)
    const erasureRes = await request.post(`${API}/api/v1/erasure/requests`, {
      headers: { Cookie: clientCookie, "Content-Type": "application/json" },
      data: {
        subjectId: `E2E-${Date.now()}`,
        reason: "E2E DPDPA erasure test",
        searchQuery: searchTerm,
      },
    });
    expect(erasureRes.ok()).toBeTruthy();

    await page.getByRole("button", { name: "Compliance" }).click();
    await expect(page.getByText(/awaiting degauss|completed/i)).toBeVisible({ timeout: 10_000 });

    await adminPage.getByRole("button", { name: "Erasure queue" }).click();
    await expect(adminPage.getByText(searchTerm)).toBeVisible({ timeout: 10_000 });
    await adminPage.getByRole("button", { name: "Confirm degauss" }).first().click();

    await page.getByRole("button", { name: "Compliance" }).click();
    await expect(page.getByRole("link", { name: "Download certificate" })).toBeVisible({
      timeout: 15_000,
    });

    await adminPage.close();
  });
});
