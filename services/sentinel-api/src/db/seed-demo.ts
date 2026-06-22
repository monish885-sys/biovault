import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Types } from "mongoose";
import { createLogger } from "@biovault/common";
import { config, getStagingPath } from "../config.js";
import { CertificateModel } from "./schemas/certificate.js";
import { AuditEventModel } from "./schemas/audit-event.js";
import { ErasureRequestModel } from "./schemas/erasure-request.js";
import { FileModel } from "./schemas/file.js";
import { FileLocationModel } from "./schemas/file-location.js";
import { IngestJobModel } from "./schemas/ingest-job.js";
import { RetrievalJobModel } from "./schemas/retrieval-job.js";
import { TapeModel } from "./schemas/tape.js";
import { buildFilenameSearchTokens } from "../search/filename-tokens.js";
import { buildKeywordSearchTokens } from "../search/keyword-tokens.js";
import { computeTapeHealthScore } from "../modules/tapes/health.js";
import { RETRIEVAL_SLA_MS } from "../modules/retrieval/retrieval.constants.js";
import {
  catalogSizeBytes,
  demoDocumentChecksum,
  generateDemoDocument,
} from "./demo-documents.js";

const log = createLogger("seed-demo", config.logLevel);

type DemoUserIds = {
  clientAdminId: Types.ObjectId;
  complianceId: Types.ObjectId;
  technicianId: Types.ObjectId;
};

type DemoFileSpec = {
  filename: string;
  fileType: string;
  category: string;
  sizeBytes: number;
  keywords: string[];
  tapeBarcode: string;
  blockId: string;
};

const DEMO_FILES: DemoFileSpec[] = [
  {
    filename: "mri-brain-patient-0312.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["patient", "0312", "mri", "brain"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-001",
  },
  {
    filename: "ct-chest-p0042-2024.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["patient", "0042", "ct", "chest"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-002",
  },
  {
    filename: "xray-lumbar-spine-8841.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["xray", "lumbar", "8841"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-003",
  },
  {
    filename: "ultrasound-abdominal-7720.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["ultrasound", "abdominal"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-004",
  },
  {
    filename: "lab-cbc-panel-2024-4410.pdf",
    fileType: "pdf",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["lab", "cbc", "4410"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-005",
  },
  {
    filename: "lab-metabolic-panel-9921.pdf",
    fileType: "pdf",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["lab", "metabolic", "9921"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-006",
  },
  {
    filename: "lab-results-export-2024.csv",
    fileType: "csv",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["lab", "export", "csv"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-007",
  },
  {
    filename: "patient-chart-summary-0312.json",
    fileType: "json",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["patient", "0312", "chart"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-008",
  },
  {
    filename: "pathology-biopsy-2023-1188.pdf",
    fileType: "pdf",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["pathology", "biopsy", "1188"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-009",
  },
  {
    filename: "cardiology-ecg-holter-5566.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["cardiology", "ecg", "holter"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-010",
  },
  {
    filename: "radiology-report-p0042-signed.pdf",
    fileType: "pdf",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["patient", "0042", "radiology", "report"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-011",
  },
  {
    filename: "discharge-summary-2024-0312.pdf",
    fileType: "pdf",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["patient", "0312", "discharge"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-012",
  },
  {
    filename: "consent-form-dpdpa-0042.pdf",
    fileType: "pdf",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["patient", "0042", "consent", "dpdpa"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-013",
  },
  {
    filename: "lis-hl7-oru-r01-4410.hl7",
    fileType: "hl7",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["hl7", "lab", "4410"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-014",
  },
  {
    filename: "clinical-note-8841.xml",
    fileType: "xml",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["clinical", "note", "8841"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-015",
  },
  {
    filename: "nursing-handoff-7720.txt",
    fileType: "txt",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["nursing", "handoff", "7720"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-016",
  },
  {
    filename: "mri-knee-patient-7720.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["patient", "7720", "mri", "knee"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-017",
  },
  {
    filename: "billing-ledger-q2-2024.xlsx",
    fileType: "xlsx",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["billing", "ledger"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-018",
  },
  {
    filename: "imaging-thumbnail-spine-8841.png",
    fileType: "png",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["imaging", "thumbnail", "8841"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-019",
  },
  {
    filename: "policy-retention-memo.docx",
    fileType: "docx",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["policy", "retention", "memo"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-020",
  },
].map((spec) => ({
  ...spec,
  sizeBytes: catalogSizeBytes(spec.filename, spec.fileType),
}));

function demoChecksum(spec: DemoFileSpec): string {
  return demoDocumentChecksum(spec.filename, spec.fileType, spec.category);
}

function tapeSimBlockPath(barcode: string, blockId: string): string {
  return join(getStagingPath(), "tape-sim", barcode, `${blockId}.bin`);
}

/** Realistic small document bytes written to tape-sim (catalog sizeBytes remain for billing TB). */
function demoTapePayload(spec: DemoFileSpec): Buffer {
  return generateDemoDocument(spec.filename, spec.fileType, spec.category);
}

async function writeDemoTapeBlock(spec: DemoFileSpec): Promise<void> {
  const path = tapeSimBlockPath(spec.tapeBarcode, spec.blockId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, demoTapePayload(spec));
}

async function clearDemoTapeBlocks(): Promise<void> {
  for (const spec of DEMO_FILES) {
    await rm(tapeSimBlockPath(spec.tapeBarcode, spec.blockId), { force: true });
  }
}

async function clearClientDemoData(clientId: Types.ObjectId): Promise<void> {
  const fileIds = await FileModel.find({ clientId }).select("_id").lean();
  const ids = fileIds.map((f) => f._id);
  await Promise.all([
    RetrievalJobModel.deleteMany({ clientId }),
    ErasureRequestModel.deleteMany({ clientId }),
    FileLocationModel.deleteMany({ fileId: { $in: ids } }),
    FileModel.deleteMany({ clientId }),
    IngestJobModel.deleteMany({ clientId }),
  ]);
}

export async function seedDemoData(
  clientId: Types.ObjectId,
  users: DemoUserIds,
): Promise<void> {
  const clientIdStr = String(clientId);
  await clearClientDemoData(clientId);
  await clearDemoTapeBlocks();

  const now = Date.now();
  const tapeCapBytes = 120_000_000_000;
  const tapeUsage = new Map<string, number>([
    ["TAPE-ACME-001", 0],
    ["TAPE-ACME-002", 0],
    ["TAPE-ACME-003", 0],
  ]);

  // Ingest job 1 — imaging batch (sealed 14 days ago)
  const job1Created = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const job1Files = DEMO_FILES.slice(0, 8);
  const job1 = await IngestJobModel.create({
    clientId,
    status: "sealed",
    tapeBarcode: "TAPE-ACME-001",
    fileCount: job1Files.length,
    totalBytes: job1Files.reduce((s, f) => s + f.sizeBytes, 0),
    sealedAt: new Date(job1Created.getTime() + 3600_000),
    createdAt: job1Created,
    updatedAt: job1Created,
  });

  // Ingest job 2 — mixed batch (sealed 3 days ago)
  const job2Created = new Date(now - 3 * 24 * 60 * 60 * 1000);
  const job2Files = DEMO_FILES.slice(8, 16);
  const job2 = await IngestJobModel.create({
    clientId,
    status: "sealed",
    tapeBarcode: "TAPE-ACME-002",
    fileCount: job2Files.length,
    totalBytes: job2Files.reduce((s, f) => s + f.sizeBytes, 0),
    sealedAt: new Date(job2Created.getTime() + 1800_000),
    createdAt: job2Created,
    updatedAt: job2Created,
  });

  const job3Created = new Date(now - 1 * 24 * 60 * 60 * 1000);
  const job3Files = DEMO_FILES.slice(16);
  const job3 = await IngestJobModel.create({
    clientId,
    status: "sealed",
    tapeBarcode: "TAPE-ACME-003",
    fileCount: job3Files.length,
    totalBytes: job3Files.reduce((s, f) => s + f.sizeBytes, 0),
    sealedAt: new Date(job3Created.getTime() + 900_000),
    createdAt: job3Created,
    updatedAt: job3Created,
  });

  const jobByFileIndex = (idx: number) => {
    if (idx < 8) return job1._id;
    if (idx < 16) return job2._id;
    return job3._id;
  };

  const fileDocs: Array<{ _id: Types.ObjectId; spec: DemoFileSpec }> = [];

  for (let i = 0; i < DEMO_FILES.length; i++) {
    const spec = DEMO_FILES[i]!;
    const ingestedAt = i < 8 ? job1Created : i < 16 ? job2Created : job3Created;
    const doc = await FileModel.create({
      clientId,
      ingestJobId: jobByFileIndex(i),
      filename: spec.filename,
      filenameSearchTokens: buildFilenameSearchTokens(spec.filename, clientIdStr),
      keywordSearchTokens: buildKeywordSearchTokens(
        { tags: spec.keywords.join(" ") },
        clientIdStr,
      ),
      fileType: spec.fileType,
      category: spec.category,
      sizeBytes: spec.sizeBytes,
      checksumSha256: demoChecksum(spec),
      status: "on_tape",
      createdAt: ingestedAt,
      updatedAt: ingestedAt,
    });
    fileDocs.push({ _id: doc._id as Types.ObjectId, spec });

    await FileLocationModel.create({
      fileId: doc._id,
      tapeBarcode: spec.tapeBarcode,
      blockId: spec.blockId,
      byteOffset: tapeUsage.get(spec.tapeBarcode) ?? 0,
    });
    await writeDemoTapeBlock(spec);
    tapeUsage.set(spec.tapeBarcode, (tapeUsage.get(spec.tapeBarcode) ?? 0) + spec.sizeBytes);
  }

  // Update tapes
  const tapePurchasedOld = new Date(now - 5.2 * 365.25 * 24 * 60 * 60 * 1000);
  const tapePurchasedMid = new Date(now - 2.5 * 365.25 * 24 * 60 * 60 * 1000);

  for (const [barcode, used] of tapeUsage) {
    const fillPercent = Math.min(99, Math.round((used / tapeCapBytes) * 100));
    const writeCycles = barcode === "TAPE-ACME-001" ? 42 : barcode === "TAPE-ACME-002" ? 18 : 6;
    const purchasedAt = barcode === "TAPE-ACME-003" ? tapePurchasedMid : tapePurchasedOld;
    const healthScore = computeTapeHealthScore({ writeCycles, fillPercent, purchasedAt });
    await TapeModel.findOneAndUpdate(
      { barcode },
      {
        $set: {
          status: "active",
          fillPercent,
          writeCycles,
          purchasedAt,
          healthScore,
          rack: barcode === "TAPE-ACME-003" ? "R2" : "R1",
          slot: barcode === "TAPE-ACME-001" ? "S01" : barcode === "TAPE-ACME-002" ? "S02" : "S01",
        },
        $setOnInsert: { barcode },
      },
      { upsert: true },
    );
  }

  // Ensure empty tape for future ingests
  await TapeModel.findOneAndUpdate(
    { barcode: "TAPE-ACME-004" },
    {
      $setOnInsert: {
        barcode: "TAPE-ACME-004",
        rack: "R2",
        slot: "S02",
        status: "empty",
        fillPercent: 0,
        healthScore: "green",
        writeCycles: 0,
      },
    },
    { upsert: true },
  );

  const fileByName = (name: string) => fileDocs.find((f) => f.spec.filename === name)!._id;

  // Retrieval jobs — varied statuses for live admin queue + client tracker
  const pendingFile = fileByName("mri-knee-patient-7720.dcm");
  const assignedFile = fileByName("cardiology-ecg-holter-5566.dcm");
  const inProgressFile = fileByName("pathology-biopsy-2023-1188.pdf");
  const deliveredFile1 = fileByName("ct-chest-p0042-2024.dcm");
  const deliveredFile2 = fileByName("lab-cbc-panel-2024-4410.pdf");

  const mkDue = (created: Date) => new Date(created.getTime() + RETRIEVAL_SLA_MS);

  const pendingCreated = new Date(now - 2 * 60_000);
  await RetrievalJobModel.create({
    clientId,
    fileId: pendingFile,
    requestedBy: users.clientAdminId,
    status: "pending",
    dueAt: mkDue(pendingCreated),
    createdAt: pendingCreated,
  });

  const assignedCreated = new Date(now - 8 * 60_000);
  await RetrievalJobModel.create({
    clientId,
    fileId: assignedFile,
    requestedBy: users.complianceId,
    status: "assigned",
    assignedTo: users.technicianId,
    dueAt: mkDue(assignedCreated),
    createdAt: assignedCreated,
  });

  const progressCreated = new Date(now - 12 * 60_000);
  await RetrievalJobModel.create({
    clientId,
    fileId: inProgressFile,
    requestedBy: users.clientAdminId,
    status: "in_progress",
    assignedTo: users.technicianId,
    dueAt: mkDue(progressCreated),
    createdAt: progressCreated,
  });

  const delivered1Created = new Date(now - 2 * 24 * 60 * 60 * 1000);
  await RetrievalJobModel.create({
    clientId,
    fileId: deliveredFile1,
    requestedBy: users.clientAdminId,
    status: "delivered",
    assignedTo: users.technicianId,
    dueAt: mkDue(delivered1Created),
    completedAt: new Date(delivered1Created.getTime() + 8 * 60_000),
    createdAt: delivered1Created,
  });

  const delivered2Created = new Date(now - 5 * 24 * 60 * 60 * 1000);
  await RetrievalJobModel.create({
    clientId,
    fileId: deliveredFile2,
    requestedBy: users.complianceId,
    status: "delivered",
    assignedTo: users.technicianId,
    dueAt: mkDue(delivered2Created),
    completedAt: new Date(delivered2Created.getTime() + 11 * 60_000),
    createdAt: delivered2Created,
  });

  // Erasure request — awaiting degauss (matches patient 0042 files)
  const erasureFiles = fileDocs.filter((f) => f.spec.keywords.includes("0042")).map((f) => f._id);
  await ErasureRequestModel.create({
    clientId,
    requestedBy: users.complianceId,
    subjectId: "SUBJ-DPDPA-0042",
    reason: "DPDPA Right to Erasure — patient relocation request",
    searchQuery: "patient 0042",
    status: "awaiting_degauss",
    matchedFileIds: erasureFiles,
    affectedTapeBarcodes: ["TAPE-ACME-001", "TAPE-ACME-002"],
    createdAt: new Date(now - 4 * 60 * 60 * 1000),
  });

  // Completed erasure (historical) with signed certificate
  const deletedFile = fileByName("consent-form-dpdpa-0042.pdf");
  await FileModel.updateOne({ _id: deletedFile }, { $set: { status: "deleted" } });
  const histCert = await CertificateModel.create({
    type: "deletion_confirmation",
    clientId,
    pdfStorageRef: "demo/deletion-SUBJ-DPDPA-9910.pdf",
    pdfSha256: createHash("sha256").update("demo-deletion-cert-9910").digest("hex"),
    issuedAt: new Date(now - 30 * 24 * 60 * 60 * 1000),
    metadata: { subjectId: "SUBJ-DPDPA-9910", demo: true },
  });
  await ErasureRequestModel.create({
    clientId,
    requestedBy: users.complianceId,
    subjectId: "SUBJ-DPDPA-9910",
    reason: "DPDPA erasure — expired consent withdrawal",
    searchQuery: "consent dpdpa",
    status: "completed",
    matchedFileIds: [deletedFile],
    affectedTapeBarcodes: ["TAPE-ACME-002"],
    completedBy: users.technicianId,
    completedAt: new Date(now - 30 * 24 * 60 * 60 * 1000),
    degaussMethod: "degauss",
    certificateId: histCert._id,
    createdAt: new Date(now - 31 * 24 * 60 * 60 * 1000),
  });

  // Sample audit trail entries
  await AuditEventModel.create({
    action: "ingest.sealed",
    userId: users.clientAdminId,
    clientId,
    ipAddress: "127.0.0.1",
    payload: { jobId: String(job1._id), fileCount: job1Files.length, demo: true },
    payloadHash: createHash("sha256").update("demo-ingest-1").digest("hex"),
  });
  await AuditEventModel.create({
    action: "retrieval.requested",
    userId: users.clientAdminId,
    clientId,
    ipAddress: "127.0.0.1",
    payload: { fileId: String(pendingFile), demo: true },
    payloadHash: createHash("sha256").update("demo-retrieval-pending").digest("hex"),
  });

  log.info("demo catalog ready", {
    files: DEMO_FILES.length,
    retrievalJobs: 5,
    erasureRequests: 2,
    tapesLive: 3,
    tapeSimPath: join(getStagingPath(), "tape-sim"),
  });
}
