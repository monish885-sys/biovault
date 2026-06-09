import { extname } from "node:path";
import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
import type { Request } from "express";
import { Types } from "mongoose";
import { NotFoundError, ValidationError } from "@biovault/common";
import { FileModel } from "../../db/schemas/file.js";
import { FileLocationModel } from "../../db/schemas/file-location.js";
import { IngestJobModel } from "../../db/schemas/ingest-job.js";
import { TapeModel } from "../../db/schemas/tape.js";
import { hashReadableStream } from "../../lib/stream-hash.js";
import { buildFilenameSearchTokens } from "../../search/filename-tokens.js";
import { buildKeywordSearchTokens } from "../../search/keyword-tokens.js";
import { getTapeAdapter } from "../../tape/index.js";
import { computeTapeHealthScore } from "../tapes/health.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import { enqueueTapeWrite } from "./ingest.queue.js";
import { parseMultipart, type StagedUpload } from "./multipart.js";
import { ingestJobDir, stagedFilePath } from "./staging.js";

export type IngestFileSummary = {
  id: string;
  filename: string;
  fileType: string;
  category: string;
  sizeBytes: number;
  checksumSha256: string;
  status: string;
};

export type IngestJobSummary = {
  id: string;
  status: string;
  fileCount: number;
  totalBytes: number;
  createdAt: string;
  files: IngestFileSummary[];
};

export type IngestReportFile = IngestFileSummary & {
  verified: boolean;
};

export type IngestReport = {
  jobId: string;
  status: string;
  fileCount: number;
  totalBytes: number;
  createdAt: string;
  sealedAt?: string;
  files: IngestReportFile[];
};

function inferFileType(filename: string, mimeType: string): string {
  const ext = extname(filename).replace(/^\./, "").toLowerCase();
  if (ext) return ext;
  const subtype = mimeType.split("/")[1];
  return subtype && subtype !== "octet-stream" ? subtype : "unknown";
}

function toFileSummary(doc: {
  _id: Types.ObjectId;
  filename: string;
  fileType: string;
  category: string;
  sizeBytes: number;
  checksumSha256: string;
  status: string;
}): IngestFileSummary {
  return {
    id: String(doc._id),
    filename: doc.filename,
    fileType: doc.fileType,
    category: doc.category,
    sizeBytes: doc.sizeBytes,
    checksumSha256: doc.checksumSha256,
    status: doc.status,
  };
}

function toJobSummary(
  job: {
    _id: Types.ObjectId;
    status: string;
    fileCount: number;
    totalBytes: number;
    createdAt?: Date;
  },
  files: IngestFileSummary[],
): IngestJobSummary {
  return {
    id: String(job._id),
    status: job.status,
    fileCount: job.fileCount,
    totalBytes: job.totalBytes,
    createdAt: (job.createdAt ?? new Date()).toISOString(),
    files,
  };
}

export async function createIngestJobFromUpload(
  clientId: string,
  userId: string,
  req: Request,
  ipAddress?: string,
): Promise<IngestJobSummary> {
  const job = await IngestJobModel.create({
    clientId: new Types.ObjectId(clientId),
    status: "received",
    fileCount: 0,
    totalBytes: 0,
  });

  const { fields, files } = await parseMultipart(req, String(job._id));
  const category = fields.category?.trim() || "general";
  const keywordMetadata = parseKeywordMetadata(fields.keywords);

  const indexedFiles: IngestFileSummary[] = [];
  let totalBytes = 0;

  for (const upload of files) {
    indexedFiles.push(
      await indexStagedUpload(clientId, job._id, upload, category, keywordMetadata),
    );
    totalBytes += upload.sizeBytes;
  }

  job.status = "indexing";
  job.fileCount = indexedFiles.length;
  job.totalBytes = totalBytes;
  await job.save();

  await recordAuditEvent({
    action: "ingest.job_created",
    userId: new Types.ObjectId(userId),
    clientId: new Types.ObjectId(clientId),
    ipAddress,
    payload: {
      ingestJobId: String(job._id),
      fileCount: job.fileCount,
      totalBytes: job.totalBytes,
    },
  });

  await recordAuditEvent({
    action: "ingest.files_indexed",
    userId: new Types.ObjectId(userId),
    clientId: new Types.ObjectId(clientId),
    ipAddress,
    payload: {
      ingestJobId: String(job._id),
      fileIds: indexedFiles.map((f) => f.id),
      checksums: indexedFiles.map((f) => f.checksumSha256),
    },
  });

  await enqueueTapeWrite(String(job._id));

  return toJobSummary(job, indexedFiles);
}

function parseKeywordMetadata(raw: string | undefined): Record<string, string> | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new ValidationError("keywords must be a JSON object of string values");
    }
    for (const value of Object.values(parsed)) {
      if (typeof value !== "string") {
        throw new ValidationError("keywords must be a JSON object of string values");
      }
    }
    return parsed as Record<string, string>;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("keywords must be valid JSON");
  }
}

async function indexStagedUpload(
  clientId: string,
  ingestJobId: Types.ObjectId,
  upload: StagedUpload,
  category: string,
  keywordMetadata?: Record<string, string>,
): Promise<IngestFileSummary> {
  const filename = upload.filename?.trim();
  if (!filename) {
    throw new ValidationError("Each uploaded file must have a filename");
  }

  const fileDoc = await FileModel.create({
    clientId: new Types.ObjectId(clientId),
    ingestJobId,
    filename,
    filenameSearchTokens: buildFilenameSearchTokens(filename, clientId),
    keywordMetadata,
    keywordSearchTokens: buildKeywordSearchTokens(keywordMetadata, clientId),
    fileType: inferFileType(filename, upload.mimeType),
    category,
    sizeBytes: upload.sizeBytes,
    checksumSha256: upload.checksumSha256,
    status: "indexing",
  });

  return toFileSummary(fileDoc);
}

export async function getIngestJobForClient(
  clientId: string,
  jobId: string,
): Promise<IngestJobSummary> {
  if (!Types.ObjectId.isValid(jobId)) {
    throw new NotFoundError("Ingest job not found");
  }

  const job = await IngestJobModel.findOne({
    _id: jobId,
    clientId: new Types.ObjectId(clientId),
  }).lean();

  if (!job) {
    throw new NotFoundError("Ingest job not found");
  }

  const files = await FileModel.find({ ingestJobId: job._id }).lean();
  return toJobSummary(
    job,
    files.map((f) => toFileSummary(f)),
  );
}

export async function getIngestReportForClient(
  clientId: string,
  jobId: string,
): Promise<IngestReport> {
  if (!Types.ObjectId.isValid(jobId)) {
    throw new NotFoundError("Ingest job not found");
  }

  const job = await IngestJobModel.findOne({
    _id: jobId,
    clientId: new Types.ObjectId(clientId),
  }).lean();

  if (!job) {
    throw new NotFoundError("Ingest job not found");
  }

  if (job.status !== "sealed") {
    throw new NotFoundError("Ingest report not available until job is sealed");
  }

  const files = await FileModel.find({ ingestJobId: job._id }).lean();
  return {
    jobId: String(job._id),
    status: job.status,
    fileCount: job.fileCount,
    totalBytes: job.totalBytes,
    createdAt: (job.createdAt ?? new Date()).toISOString(),
    sealedAt: job.sealedAt?.toISOString(),
    files: files.map((f) => ({
      ...toFileSummary(f),
      verified: f.status === "on_tape",
    })),
  };
}

/** D4: write indexed files to tape simulator and record file_locations. */
export async function processTapeWrite(ingestJobId: string): Promise<void> {
  if (!Types.ObjectId.isValid(ingestJobId)) {
    throw new ValidationError("Invalid ingest job id");
  }

  const job = await IngestJobModel.findById(ingestJobId);
  if (!job) {
    throw new NotFoundError("Ingest job not found");
  }
  if (job.status !== "indexing") {
    return;
  }

  const files = await FileModel.find({ ingestJobId: job._id, status: "indexing" }).lean();
  if (files.length === 0) {
    return;
  }

  const tape = await TapeModel.findOne({
    status: { $in: ["empty", "active"] },
    fillPercent: { $lt: 100 },
  }).sort({ fillPercent: 1 });

  if (!tape) {
    job.status = "failed";
    job.errorMessage = "No available tape cartridge in inventory";
    await job.save();
    return;
  }

  job.status = "writing";
  job.tapeBarcode = tape.barcode;
  await job.save();

  tape.status = "writing";
  await tape.save();

  const adapter = getTapeAdapter();
  await adapter.mount(tape.barcode);

  let bytesWritten = 0;
  const tapeCapacityBytes = 18 * 1024 * 1024 * 1024 * 1024;

  try {
    for (const file of files) {
      const path = stagedFilePath(ingestJobId, file.filename);
      const stream = createReadStream(path);
      const result = await adapter.writeSequential(tape.barcode, stream);

      await FileLocationModel.create({
        fileId: file._id,
        tapeBarcode: tape.barcode,
        blockId: result.blockId,
        byteOffset: result.byteOffset,
      });

      bytesWritten += result.bytesWritten;
    }

    const addedFill = Math.round((bytesWritten / tapeCapacityBytes) * 100);
    tape.fillPercent = Math.min(100, tape.fillPercent + addedFill);
    tape.writeCycles += 1;
    tape.healthScore = computeTapeHealthScore(tape);
    await tape.save();

    job.status = "verifying";
    await job.save();
  } catch (err) {
    job.status = "failed";
    job.errorMessage = err instanceof Error ? err.message : "Tape write failed";
    await job.save();
    tape.status = "empty";
    await tape.save();
    throw err;
  } finally {
    await adapter.unmount(tape.barcode);
  }
}

/** D5: read-back SHA-256 verify, seal job, purge ingest staging. */
export async function processTapeVerify(ingestJobId: string): Promise<void> {
  if (!Types.ObjectId.isValid(ingestJobId)) {
    throw new ValidationError("Invalid ingest job id");
  }

  const job = await IngestJobModel.findById(ingestJobId);
  if (!job) {
    throw new NotFoundError("Ingest job not found");
  }
  if (job.status !== "verifying") {
    return;
  }

  const tapeBarcode = job.tapeBarcode;
  if (!tapeBarcode) {
    job.status = "failed";
    job.errorMessage = "Missing tape assignment for verification";
    await job.save();
    return;
  }

  const files = await FileModel.find({ ingestJobId: job._id, status: "indexing" }).lean();
  if (files.length === 0) {
    return;
  }

  const adapter = getTapeAdapter();
  await adapter.mount(tapeBarcode);

  try {
    for (const file of files) {
      const loc = await FileLocationModel.findOne({ fileId: file._id }).lean();
      if (!loc) {
        throw new Error(`Missing tape location for file ${String(file._id)}`);
      }

      const stream = await adapter.readSequential(tapeBarcode, loc);
      const readHash = await hashReadableStream(stream);
      if (readHash !== file.checksumSha256) {
        throw new Error(`Read-back checksum mismatch for file ${String(file._id)}`);
      }

      await FileModel.updateOne({ _id: file._id }, { $set: { status: "on_tape" } });
    }

    job.status = "sealed";
    job.sealedAt = new Date();
    await job.save();

    const tape = await TapeModel.findOne({ barcode: tapeBarcode });
    if (tape) {
      tape.status = "active";
      await tape.save();
    }

    await rm(ingestJobDir(ingestJobId), { recursive: true, force: true });

    await recordAuditEvent({
      action: "ingest.job_sealed",
      clientId: new Types.ObjectId(String(job.clientId)),
      payload: {
        ingestJobId: String(job._id),
        fileIds: files.map((f) => String(f._id)),
      },
    });
  } catch (err) {
    job.status = "failed";
    job.errorMessage = err instanceof Error ? err.message : "Tape verification failed";
    await job.save();

    const tape = await TapeModel.findOne({ barcode: tapeBarcode });
    if (tape && tape.status === "writing") {
      tape.status = "active";
      await tape.save();
    }

    await recordAuditEvent({
      action: "ingest.job_failed",
      clientId: new Types.ObjectId(String(job.clientId)),
      payload: {
        ingestJobId: String(job._id),
        phase: "verify",
        error: job.errorMessage,
      },
    });

    throw err;
  } finally {
    await adapter.unmount(tapeBarcode);
  }
}
