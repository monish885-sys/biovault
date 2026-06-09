import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { NotFoundError } from "@biovault/common";
import { CertificateModel } from "../../db/schemas/certificate.js";
import { ClientModel } from "../../db/schemas/client.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import { getIngestReportForClient, type IngestReport } from "../ingest/ingest.service.js";
import { buildIngestCertificatePdf } from "./pdf.js";
import { signBuffer } from "./signing.js";
import { readCertificatePdf, writeCertificatePdf } from "./storage.js";

export type CertificateSummary = {
  id: string;
  type: string;
  clientId: string;
  ingestJobId: string;
  pdfSha256: string;
  issuedAt: string;
  metadata: {
    algorithm: string;
    signature: string;
    contentHash: string;
    fileCount: number;
    totalBytes: number;
  };
};

function hashContent(report: IngestReport, clientName: string): string {
  const canonical = JSON.stringify({
    clientName,
    jobId: report.jobId,
    sealedAt: report.sealedAt,
    fileCount: report.fileCount,
    totalBytes: report.totalBytes,
    files: report.files.map((f) => ({
      filename: f.filename,
      checksumSha256: f.checksumSha256,
      verified: f.verified,
    })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function toSummary(doc: {
  _id: Types.ObjectId | { toString(): string };
  type: string;
  clientId: Types.ObjectId | { toString(): string };
  pdfSha256: string;
  issuedAt?: Date;
  metadata?: Record<string, unknown>;
}): CertificateSummary {
  const meta = (doc.metadata ?? {}) as CertificateSummary["metadata"] & { ingestJobId?: string };
  return {
    id: String(doc._id),
    type: doc.type,
    clientId: String(doc.clientId),
    ingestJobId: meta.ingestJobId ?? "",
    pdfSha256: doc.pdfSha256,
    issuedAt: (doc.issuedAt ?? new Date()).toISOString(),
    metadata: {
      algorithm: meta.algorithm ?? "",
      signature: meta.signature ?? "",
      contentHash: meta.contentHash ?? "",
      fileCount: meta.fileCount ?? 0,
      totalBytes: meta.totalBytes ?? 0,
    },
  };
}

export async function getIngestCertificateForClient(
  clientId: string,
  jobId: string,
): Promise<CertificateSummary | null> {
  const existing = await CertificateModel.findOne({
    clientId: new Types.ObjectId(clientId),
    type: "ingest_summary",
    "metadata.ingestJobId": jobId,
  }).lean();

  if (!existing) return null;
  return toSummary(existing);
}

export async function issueIngestCertificate(
  clientId: string,
  jobId: string,
  userId?: string,
  ipAddress?: string,
): Promise<CertificateSummary> {
  const existing = await getIngestCertificateForClient(clientId, jobId);
  if (existing) return existing;

  const report = await getIngestReportForClient(clientId, jobId);
  const client = await ClientModel.findById(clientId).select("name").lean();
  if (!client) {
    throw new NotFoundError("Client not found");
  }

  const contentHash = hashContent(report, client.name);
  const { algorithm, signature } = await signBuffer(Buffer.from(contentHash, "hex"));

  const draftPdf = await buildIngestCertificatePdf({
    clientName: client.name,
    jobId: report.jobId,
    sealedAt: report.sealedAt ?? report.createdAt,
    fileCount: report.fileCount,
    totalBytes: report.totalBytes,
    files: report.files,
    pdfSha256: contentHash,
    algorithm,
    signature,
  });

  const pdfSha256 = createHash("sha256").update(draftPdf).digest("hex");
  const cert = await CertificateModel.create({
    type: "ingest_summary",
    clientId: new Types.ObjectId(clientId),
    pdfStorageRef: jobId,
    pdfSha256,
    metadata: {
      ingestJobId: jobId,
      algorithm,
      signature,
      contentHash,
      fileCount: report.fileCount,
      totalBytes: report.totalBytes,
    },
  });

  await writeCertificatePdf(String(cert._id), draftPdf);

  await recordAuditEvent({
    action: "certificate.ingest_issued",
    userId: userId ? new Types.ObjectId(userId) : undefined,
    clientId: new Types.ObjectId(clientId),
    ipAddress,
    payload: {
      certificateId: String(cert._id),
      ingestJobId: jobId,
      pdfSha256,
      algorithm,
    },
  });

  return toSummary(cert);
}

export async function readIngestCertificatePdfForClient(
  clientId: string,
  jobId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const cert = await CertificateModel.findOne({
    clientId: new Types.ObjectId(clientId),
    type: "ingest_summary",
    "metadata.ingestJobId": jobId,
  }).lean();

  if (!cert) {
    throw new NotFoundError("Certificate not found for this ingest job");
  }

  const buffer = await readCertificatePdf(String(cert._id));
  return {
    buffer,
    filename: `biovault-ingest-${jobId}.pdf`,
  };
}

/** Called automatically when an ingest job is sealed. */
export async function autoIssueIngestCertificate(
  clientId: string,
  jobId: string,
): Promise<void> {
  try {
    await issueIngestCertificate(clientId, jobId);
  } catch {
    // Certificate issuance must not block ingest sealing.
  }
}
