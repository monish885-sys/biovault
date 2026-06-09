import { describe, expect, it, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

const store = {
  certificates: [] as Array<Record<string, unknown>>,
  clients: [{ _id: new Types.ObjectId(), name: "Acme Hospital" }],
  reports: new Map<string, Record<string, unknown>>(),
  auditEvents: [] as Array<Record<string, unknown>>,
  writtenPdfs: new Map<string, Uint8Array>(),
};

function findStoredCertificate(filter: Record<string, unknown>) {
  const jobId = (filter as { "metadata.ingestJobId"?: string })["metadata.ingestJobId"];
  return (
    store.certificates.find(
      (c) =>
        c.type === filter.type &&
        String(c.clientId) === String(filter.clientId) &&
        (c.metadata as { ingestJobId?: string })?.ingestJobId === jobId,
    ) ?? null
  );
}

vi.mock("../../db/schemas/certificate.js", () => ({
  CertificateModel: {
    findOne: vi.fn((filter: Record<string, unknown>) => ({
      lean: vi.fn(async () => findStoredCertificate(filter)),
    })),
    create: vi.fn(async (doc: Record<string, unknown>) => {
      const created = { _id: new Types.ObjectId(), ...doc };
      store.certificates.push(created);
      return created;
    }),
  },
}));

vi.mock("../../db/schemas/client.js", () => ({
  ClientModel: {
    findById: vi.fn((id: string) => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () =>
          store.clients.find((c) => String(c._id) === String(id)) ?? null,
        ),
      })),
    })),
  },
}));

vi.mock("../ingest/ingest.service.js", () => ({
  getIngestReportForClient: vi.fn(async (_clientId: string, jobId: string) => {
    const report = store.reports.get(jobId);
    if (!report) throw new Error("not found");
    return report;
  }),
}));

vi.mock("../audit/audit.service.js", () => ({
  recordAuditEvent: vi.fn(async (params: Record<string, unknown>) => {
    store.auditEvents.push(params);
  }),
}));

vi.mock("./storage.js", () => ({
  writeCertificatePdf: vi.fn(async (id: string, bytes: Uint8Array) => {
    store.writtenPdfs.set(id, bytes);
    return `/tmp/${id}.pdf`;
  }),
  readCertificatePdf: vi.fn(async (id: string) => Buffer.from(store.writtenPdfs.get(id) ?? [])),
}));

import { issueIngestCertificate } from "./certificates.service.js";

describe("issueIngestCertificate", () => {
  const clientId = String(store.clients[0]._id);
  const jobId = new Types.ObjectId().toString();

  beforeEach(() => {
    store.certificates = [];
    store.auditEvents = [];
    store.writtenPdfs.clear();
    store.reports.set(jobId, {
      jobId,
      status: "sealed",
      fileCount: 1,
      totalBytes: 1024,
      createdAt: new Date().toISOString(),
      sealedAt: new Date().toISOString(),
      files: [
        {
          id: "f1",
          filename: "scan.dcm",
          fileType: "dcm",
          category: "imaging",
          sizeBytes: 1024,
          checksumSha256: "a".repeat(64),
          status: "on_tape",
          verified: true,
        },
      ],
    });
  });

  it("issues a signed ingest certificate and stores PDF", async () => {
    const cert = await issueIngestCertificate(
      clientId,
      jobId,
      new Types.ObjectId().toString(),
      "127.0.0.1",
    );

    expect(cert.type).toBe("ingest_summary");
    expect(cert.ingestJobId).toBe(jobId);
    expect(cert.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(cert.metadata.algorithm).toBeTruthy();
    expect(cert.metadata.signature).toBeTruthy();
    expect(store.writtenPdfs.size).toBe(1);
    expect(store.auditEvents.some((e) => e.action === "certificate.ingest_issued")).toBe(true);
  });

  it("returns existing certificate idempotently", async () => {
    const first = await issueIngestCertificate(clientId, jobId);
    const second = await issueIngestCertificate(clientId, jobId);
    expect(second.id).toBe(first.id);
    expect(store.certificates).toHaveLength(1);
  });
});
