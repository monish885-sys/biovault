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

/** Inflates catalog sizes so dashboards show realistic TB usage (tape payloads stay small). */
const DEMO_CATALOG_SCALE = 900;

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
  {
    filename: "pet-ct-oncology-p1156.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["pet", "ct", "oncology", "1156"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-021",
  },
  {
    filename: "mammography-screening-2024-3301.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["mammography", "screening", "3301"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-022",
  },
  {
    filename: "fluoroscopy-gi-series-2290.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["fluoroscopy", "gi", "2290"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-023",
  },
  {
    filename: "nuclear-medicine-bone-scan-6612.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["nuclear", "bone", "6612"],
    tapeBarcode: "TAPE-ACME-001",
    blockId: "blk-demo-024",
  },
  {
    filename: "lab-lipid-panel-2024-5520.pdf",
    fileType: "pdf",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["lab", "lipid", "5520"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-025",
  },
  {
    filename: "lab-thyroid-panel-2024-8833.pdf",
    fileType: "pdf",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["lab", "thyroid", "8833"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-026",
  },
  {
    filename: "lab-coagulation-study-4419.pdf",
    fileType: "pdf",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["lab", "coagulation", "4419"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-027",
  },
  {
    filename: "lab-urinalysis-2024-7701.pdf",
    fileType: "pdf",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["lab", "urinalysis", "7701"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-028",
  },
  {
    filename: "mri-shoulder-patient-2290.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["patient", "2290", "mri", "shoulder"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-029",
  },
  {
    filename: "ct-abdomen-pelvis-1156.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["patient", "1156", "ct", "abdomen"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-030",
  },
  {
    filename: "xray-hand-fracture-3301.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["xray", "fracture", "3301"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-031",
  },
  {
    filename: "radiology-report-p1156-signed.pdf",
    fileType: "pdf",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["patient", "1156", "radiology", "report"],
    tapeBarcode: "TAPE-ACME-002",
    blockId: "blk-demo-032",
  },
  {
    filename: "operative-note-ortho-2290.pdf",
    fileType: "pdf",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["operative", "ortho", "2290"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-033",
  },
  {
    filename: "anesthesia-record-6612.pdf",
    fileType: "pdf",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["anesthesia", "6612"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-034",
  },
  {
    filename: "medication-reconciliation-5520.json",
    fileType: "json",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["medication", "5520"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-035",
  },
  {
    filename: "allergy-intolerance-8833.xml",
    fileType: "xml",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["allergy", "8833"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-036",
  },
  {
    filename: "immunization-record-4419.pdf",
    fileType: "pdf",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["immunization", "4419"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-037",
  },
  {
    filename: "mri-spine-patient-6612.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["patient", "6612", "mri", "spine"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-038",
  },
  {
    filename: "ct-angiography-cardiac-5520.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["ct", "angiography", "cardiac", "5520"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-039",
  },
  {
    filename: "ultrasound-obstetric-8833.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["ultrasound", "obstetric", "8833"],
    tapeBarcode: "TAPE-ACME-003",
    blockId: "blk-demo-040",
  },
  {
    filename: "lis-hl7-adt-a01-7701.hl7",
    fileType: "hl7",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["hl7", "adt", "7701"],
    tapeBarcode: "TAPE-ACME-004",
    blockId: "blk-demo-041",
  },
  {
    filename: "lab-toxicology-screen-1156.pdf",
    fileType: "pdf",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["lab", "toxicology", "1156"],
    tapeBarcode: "TAPE-ACME-004",
    blockId: "blk-demo-042",
  },
  {
    filename: "pathology-cytology-3301.pdf",
    fileType: "pdf",
    category: "lab_reports",
    sizeBytes: 0,
    keywords: ["pathology", "cytology", "3301"],
    tapeBarcode: "TAPE-ACME-004",
    blockId: "blk-demo-043",
  },
  {
    filename: "discharge-summary-2024-1156.pdf",
    fileType: "pdf",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["patient", "1156", "discharge"],
    tapeBarcode: "TAPE-ACME-004",
    blockId: "blk-demo-044",
  },
  {
    filename: "consent-form-research-2290.pdf",
    fileType: "pdf",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["consent", "research", "2290"],
    tapeBarcode: "TAPE-ACME-004",
    blockId: "blk-demo-045",
  },
  {
    filename: "clinical-trial-enrollment-6612.pdf",
    fileType: "pdf",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["clinical", "trial", "6612"],
    tapeBarcode: "TAPE-ACME-004",
    blockId: "blk-demo-046",
  },
  {
    filename: "mri-liver-patient-5520.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["patient", "5520", "mri", "liver"],
    tapeBarcode: "TAPE-ACME-004",
    blockId: "blk-demo-047",
  },
  {
    filename: "ct-head-trauma-8833.dcm",
    fileType: "dcm",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["patient", "8833", "ct", "head"],
    tapeBarcode: "TAPE-ACME-004",
    blockId: "blk-demo-048",
  },
  {
    filename: "imaging-thumbnail-cardiac-5520.png",
    fileType: "png",
    category: "imaging",
    sizeBytes: 0,
    keywords: ["imaging", "thumbnail", "cardiac"],
    tapeBarcode: "TAPE-ACME-004",
    blockId: "blk-demo-049",
  },
  {
    filename: "quality-audit-report-q3-2024.xlsx",
    fileType: "xlsx",
    category: "clinical",
    sizeBytes: 0,
    keywords: ["quality", "audit", "q3"],
    tapeBarcode: "TAPE-ACME-004",
    blockId: "blk-demo-050",
  },
].map((spec) => ({
  ...spec,
  sizeBytes: Math.round(
    catalogSizeBytes(spec.filename, spec.fileType) * DEMO_CATALOG_SCALE,
  ),
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
    AuditEventModel.deleteMany({ clientId }),
    FileLocationModel.deleteMany({ fileId: { $in: ids } }),
    FileModel.deleteMany({ clientId }),
    IngestJobModel.deleteMany({ clientId }),
  ]);
}

const INGEST_BATCH_SIZE = 10;
const INGEST_BATCH_AGES_DAYS = [45, 28, 14, 3, 1];

function ingestBatchForIndex(fileIndex: number): number {
  return Math.floor(fileIndex / INGEST_BATCH_SIZE);
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
  const tapeBarcodes = [...new Set(DEMO_FILES.map((f) => f.tapeBarcode))];
  const tapeUsage = new Map<string, number>(tapeBarcodes.map((b) => [b, 0]));

  const ingestJobs: Array<{ _id: Types.ObjectId; created: Date; files: DemoFileSpec[] }> = [];
  for (let batch = 0; batch * INGEST_BATCH_SIZE < DEMO_FILES.length; batch++) {
    const files = DEMO_FILES.slice(batch * INGEST_BATCH_SIZE, (batch + 1) * INGEST_BATCH_SIZE);
    const ageDays = INGEST_BATCH_AGES_DAYS[batch] ?? 1;
    const created = new Date(now - ageDays * 24 * 60 * 60 * 1000);
    const tapeBarcode = files[0]!.tapeBarcode;
    const job = await IngestJobModel.create({
      clientId,
      status: "sealed",
      tapeBarcode,
      fileCount: files.length,
      totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0),
      sealedAt: new Date(created.getTime() + (batch + 1) * 600_000),
      createdAt: created,
      updatedAt: created,
    });
    ingestJobs.push({ _id: job._id as Types.ObjectId, created, files });
  }

  const jobByFileIndex = (idx: number) => ingestJobs[ingestBatchForIndex(idx)]!._id;

  const fileDocs: Array<{ _id: Types.ObjectId; spec: DemoFileSpec }> = [];

  for (let i = 0; i < DEMO_FILES.length; i++) {
    const spec = DEMO_FILES[i]!;
    const batch = ingestBatchForIndex(i);
    const ingestedAt = ingestJobs[batch]!.created;
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
    const writeCycles =
      barcode === "TAPE-ACME-001"
        ? 58
        : barcode === "TAPE-ACME-002"
          ? 34
          : barcode === "TAPE-ACME-003"
            ? 21
            : 9;
    const purchasedAt =
      barcode === "TAPE-ACME-004" || barcode === "TAPE-ACME-003"
        ? tapePurchasedMid
        : tapePurchasedOld;
    const healthScore = computeTapeHealthScore({ writeCycles, fillPercent, purchasedAt });
    const rack = barcode === "TAPE-ACME-003" || barcode === "TAPE-ACME-004" ? "R2" : "R1";
    const slot =
      barcode === "TAPE-ACME-001"
        ? "S01"
        : barcode === "TAPE-ACME-002"
          ? "S02"
          : barcode === "TAPE-ACME-003"
            ? "S01"
            : "S02";
    await TapeModel.findOneAndUpdate(
      { barcode },
      {
        $set: {
          status: used > 0 ? "active" : "empty",
          fillPercent,
          writeCycles,
          purchasedAt,
          healthScore,
          rack,
          slot,
        },
        $setOnInsert: { barcode },
      },
      { upsert: true },
    );
  }

  const fileByName = (name: string) => fileDocs.find((f) => f.spec.filename === name)!._id;

  // Retrieval jobs — varied statuses for live admin queue + client tracker
  const pendingFile = fileByName("mri-knee-patient-7720.dcm");
  const assignedFile = fileByName("cardiology-ecg-holter-5566.dcm");
  const inProgressFile = fileByName("pathology-biopsy-2023-1188.pdf");
  const deliveredFile1 = fileByName("ct-chest-p0042-2024.dcm");
  const deliveredFile2 = fileByName("lab-cbc-panel-2024-4410.pdf");

  const overdueFile = fileByName("mri-shoulder-patient-2290.dcm");
  const readyFile = fileByName("ct-head-trauma-8833.dcm");
  const deliveredFile3 = fileByName("mri-brain-patient-0312.dcm");
  const deliveredFile4 = fileByName("radiology-report-p0042-signed.pdf");
  const deliveredFile5 = fileByName("discharge-summary-2024-0312.pdf");
  const deliveredFile6 = fileByName("mri-spine-patient-6612.dcm");
  const deliveredFile7 = fileByName("lab-metabolic-panel-9921.pdf");

  const mkDue = (created: Date) => new Date(created.getTime() + RETRIEVAL_SLA_MS);

  const overdueCreated = new Date(now - 22 * 60_000);
  await RetrievalJobModel.create({
    clientId,
    fileId: overdueFile,
    requestedBy: users.complianceId,
    status: "pending",
    dueAt: mkDue(overdueCreated),
    createdAt: overdueCreated,
  });

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

  const readyCreated = new Date(now - 18 * 60_000);
  await RetrievalJobModel.create({
    clientId,
    fileId: readyFile,
    requestedBy: users.clientAdminId,
    status: "ready",
    assignedTo: users.technicianId,
    dueAt: mkDue(readyCreated),
    completedAt: new Date(now - 3 * 60_000),
    createdAt: readyCreated,
  });

  const deliveredSpecs: Array<{
    fileId: Types.ObjectId;
    daysAgo: number;
    minutesToComplete: number;
    by: "admin" | "compliance";
  }> = [
    { fileId: deliveredFile1, daysAgo: 2, minutesToComplete: 8, by: "admin" },
    { fileId: deliveredFile2, daysAgo: 5, minutesToComplete: 11, by: "compliance" },
    { fileId: deliveredFile3, daysAgo: 7, minutesToComplete: 9, by: "admin" },
    { fileId: deliveredFile4, daysAgo: 10, minutesToComplete: 12, by: "compliance" },
    { fileId: deliveredFile5, daysAgo: 14, minutesToComplete: 7, by: "admin" },
    { fileId: deliveredFile6, daysAgo: 21, minutesToComplete: 10, by: "compliance" },
    { fileId: deliveredFile7, daysAgo: 28, minutesToComplete: 14, by: "admin" },
  ];

  for (const spec of deliveredSpecs) {
    const created = new Date(now - spec.daysAgo * 24 * 60 * 60 * 1000);
    await RetrievalJobModel.create({
      clientId,
      fileId: spec.fileId,
      requestedBy: spec.by === "admin" ? users.clientAdminId : users.complianceId,
      status: "delivered",
      assignedTo: users.technicianId,
      dueAt: mkDue(created),
      completedAt: new Date(created.getTime() + spec.minutesToComplete * 60_000),
      createdAt: created,
    });
  }

  // Erasure request — locating (new intake)
  const locatingFiles = fileDocs.filter((f) => f.spec.keywords.includes("2290")).map((f) => f._id);
  await ErasureRequestModel.create({
    clientId,
    requestedBy: users.complianceId,
    subjectId: "SUBJ-DPDPA-2290",
    reason: "DPDPA Right to Erasure — patient data minimization",
    searchQuery: "patient 2290",
    status: "locating",
    matchedFileIds: locatingFiles.slice(0, 4),
    affectedTapeBarcodes: ["TAPE-ACME-002", "TAPE-ACME-003"],
    createdAt: new Date(now - 90 * 60_000),
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

  // Audit trail — realistic activity spread over recent weeks
  const auditActions: Array<{
    action: string;
    userId: Types.ObjectId;
    daysAgo: number;
    payload: Record<string, unknown>;
    hashKey: string;
  }> = [
    {
      action: "ingest.sealed",
      userId: users.clientAdminId,
      daysAgo: 45,
      payload: {
        jobId: String(ingestJobs[0]!._id),
        fileCount: ingestJobs[0]!.files.length,
        demo: true,
      },
      hashKey: "demo-ingest-batch-0",
    },
    {
      action: "ingest.sealed",
      userId: users.clientAdminId,
      daysAgo: 28,
      payload: {
        jobId: String(ingestJobs[1]!._id),
        fileCount: ingestJobs[1]!.files.length,
        demo: true,
      },
      hashKey: "demo-ingest-batch-1",
    },
    {
      action: "ingest.sealed",
      userId: users.clientAdminId,
      daysAgo: 14,
      payload: {
        jobId: String(ingestJobs[2]!._id),
        fileCount: ingestJobs[2]!.files.length,
        demo: true,
      },
      hashKey: "demo-ingest-batch-2",
    },
    {
      action: "ingest.sealed",
      userId: users.clientAdminId,
      daysAgo: 3,
      payload: {
        jobId: String(ingestJobs[3]!._id),
        fileCount: ingestJobs[3]!.files.length,
        demo: true,
      },
      hashKey: "demo-ingest-batch-3",
    },
    {
      action: "ingest.sealed",
      userId: users.clientAdminId,
      daysAgo: 1,
      payload: {
        jobId: String(ingestJobs[4]!._id),
        fileCount: ingestJobs[4]!.files.length,
        demo: true,
      },
      hashKey: "demo-ingest-batch-4",
    },
    {
      action: "retrieval.requested",
      userId: users.clientAdminId,
      daysAgo: 0,
      payload: { fileId: String(pendingFile), demo: true },
      hashKey: "demo-retrieval-pending",
    },
    {
      action: "retrieval.requested",
      userId: users.complianceId,
      daysAgo: 0,
      payload: { fileId: String(overdueFile), demo: true },
      hashKey: "demo-retrieval-overdue",
    },
    {
      action: "retrieval.assigned",
      userId: users.technicianId,
      daysAgo: 0,
      payload: { fileId: String(assignedFile), demo: true },
      hashKey: "demo-retrieval-assigned",
    },
    {
      action: "retrieval.completed",
      userId: users.technicianId,
      daysAgo: 2,
      payload: { fileId: String(deliveredFile1), demo: true },
      hashKey: "demo-retrieval-delivered-1",
    },
    {
      action: "retrieval.completed",
      userId: users.technicianId,
      daysAgo: 5,
      payload: { fileId: String(deliveredFile2), demo: true },
      hashKey: "demo-retrieval-delivered-2",
    },
    {
      action: "erasure.requested",
      userId: users.complianceId,
      daysAgo: 0,
      payload: { subjectId: "SUBJ-DPDPA-0042", demo: true },
      hashKey: "demo-erasure-0042",
    },
    {
      action: "erasure.requested",
      userId: users.complianceId,
      daysAgo: 0,
      payload: { subjectId: "SUBJ-DPDPA-2290", demo: true },
      hashKey: "demo-erasure-2290",
    },
    {
      action: "erasure.completed",
      userId: users.technicianId,
      daysAgo: 30,
      payload: { subjectId: "SUBJ-DPDPA-9910", demo: true },
      hashKey: "demo-erasure-completed",
    },
    {
      action: "audit.exported",
      userId: users.complianceId,
      daysAgo: 7,
      payload: { format: "json", demo: true },
      hashKey: "demo-audit-export",
    },
    {
      action: "auth.login",
      userId: users.clientAdminId,
      daysAgo: 0,
      payload: { demo: true },
      hashKey: "demo-auth-login",
    },
  ];

  let prevHash: string | undefined;
  for (const entry of auditActions) {
    const payloadHash = createHash("sha256").update(entry.hashKey).digest("hex");
    const createdAt = new Date(now - entry.daysAgo * 24 * 60 * 60 * 1000);
    await AuditEventModel.create({
      action: entry.action,
      userId: entry.userId,
      clientId,
      ipAddress: "127.0.0.1",
      payload: entry.payload,
      payloadHash,
      prevHash,
      createdAt,
    });
    prevHash = payloadHash;
  }

  log.info("demo catalog ready", {
    files: DEMO_FILES.length,
    retrievalJobs: 12,
    erasureRequests: 3,
    tapesLive: tapeBarcodes.length,
    ingestJobs: ingestJobs.length,
    tapeSimPath: join(getStagingPath(), "tape-sim"),
  });
}
