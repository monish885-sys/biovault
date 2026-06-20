import { Types } from "mongoose";
import { NotFoundError, ValidationError } from "@biovault/common";
import { ClientModel } from "../../db/schemas/client.js";
import { ErasureRequestModel } from "../../db/schemas/erasure-request.js";
import { FileModel } from "../../db/schemas/file.js";
import { FileLocationModel } from "../../db/schemas/file-location.js";
import { UserModel } from "../../db/schemas/user.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import { issueDeletionCertificate } from "../certificates/certificates.service.js";
import { tokenizeSearchText } from "../../search/tokens.js";

export type ErasureRequestSummary = {
  id: string;
  subjectId: string;
  reason: string;
  searchQuery: string;
  status: string;
  matchedFileCount: number;
  affectedTapeBarcodes?: string[];
  createdAt: string;
  completedAt?: string;
  certificateId?: string;
};

function toSummary(doc: {
  _id: Types.ObjectId | { toString(): string };
  subjectId?: string;
  reason?: string;
  searchQuery?: string;
  status?: string;
  matchedFileIds?: Types.ObjectId[];
  affectedTapeBarcodes?: string[];
  createdAt?: Date;
  completedAt?: Date | null;
  certificateId?: Types.ObjectId | null;
}): ErasureRequestSummary {
  return {
    id: String(doc._id),
    subjectId: String(doc.subjectId ?? ""),
    reason: String(doc.reason ?? ""),
    searchQuery: String(doc.searchQuery ?? ""),
    status: String(doc.status ?? "pending"),
    matchedFileCount: doc.matchedFileIds?.length ?? 0,
    affectedTapeBarcodes: doc.affectedTapeBarcodes,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : undefined,
    certificateId: doc.certificateId ? String(doc.certificateId) : undefined,
  };
}

async function locateMatchingFiles(
  clientId: string,
  searchQuery: string,
): Promise<{ fileIds: Types.ObjectId[]; tapeBarcodes: string[] }> {
  const tokens = tokenizeSearchText(searchQuery, clientId);
  if (tokens.length === 0) {
    throw new ValidationError("searchQuery must contain searchable tokens");
  }

  const files = await FileModel.find({
    clientId: new Types.ObjectId(clientId),
    status: "on_tape",
    $or: [
      { filenameSearchTokens: { $in: tokens } },
      { keywordSearchTokens: { $in: tokens } },
    ],
  })
    .select("_id")
    .lean();

  const fileIds = files.map((f) => f._id as Types.ObjectId);
  const locations = await FileLocationModel.find({
    fileId: { $in: fileIds },
  })
    .select("tapeBarcode")
    .lean();

  const tapeBarcodes = [...new Set(locations.map((l) => l.tapeBarcode))];
  return { fileIds, tapeBarcodes };
}

export async function createErasureRequest(
  clientId: string,
  userId: string,
  input: { subjectId: string; reason: string; searchQuery: string },
  ip?: string,
): Promise<ErasureRequestSummary> {
  const { fileIds, tapeBarcodes } = await locateMatchingFiles(clientId, input.searchQuery);

  const doc = await ErasureRequestModel.create({
    clientId: new Types.ObjectId(clientId),
    requestedBy: new Types.ObjectId(userId),
    subjectId: input.subjectId.trim(),
    reason: input.reason.trim(),
    searchQuery: input.searchQuery.trim(),
    status: fileIds.length > 0 ? "awaiting_degauss" : "pending",
    matchedFileIds: fileIds,
    affectedTapeBarcodes: tapeBarcodes,
  });

  await recordAuditEvent({
    action: "erasure.requested",
    userId: new Types.ObjectId(userId),
    clientId: new Types.ObjectId(clientId),
    ipAddress: ip,
    payload: {
      erasureRequestId: String(doc._id),
      subjectId: input.subjectId,
      matchedFileCount: fileIds.length,
      tapeBarcodes,
    },
  });

  return toSummary(doc);
}

export async function listErasureRequestsForClient(
  clientId: string,
): Promise<ErasureRequestSummary[]> {
  const docs = await ErasureRequestModel.find({ clientId: new Types.ObjectId(clientId) })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return docs.map(toSummary);
}

export async function listErasureRequestsAdmin(): Promise<ErasureRequestSummary[]> {
  const docs = await ErasureRequestModel.find({
    status: { $in: ["pending", "awaiting_degauss"] },
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();
  return docs.map(toSummary);
}

export async function getErasureRequestAdmin(id: string): Promise<ErasureRequestSummary & {
  clientName: string;
  filenames: string[];
  tapeLocations: Array<{ barcode: string; rack?: string; slot?: string }>;
}> {
  const doc = await ErasureRequestModel.findById(id).lean();
  if (!doc) throw new NotFoundError("Erasure request not found");

  const client = await ClientModel.findById(doc.clientId).lean();
  const files = await FileModel.find({ _id: { $in: doc.matchedFileIds ?? [] } })
    .select("filename")
    .lean();

  const { TapeModel } = await import("../../db/schemas/tape.js");
  const tapes = await TapeModel.find({
    barcode: { $in: doc.affectedTapeBarcodes ?? [] },
  })
    .select("barcode rack slot")
    .lean();

  return {
    ...toSummary(doc),
    clientName: client?.name ?? "Unknown",
    filenames: files.map((f) => f.filename),
    tapeLocations: tapes.map((t) => ({
      barcode: t.barcode,
      rack: t.rack,
      slot: t.slot,
    })),
  };
}

export async function completeErasureRequest(
  requestId: string,
  technicianId: string,
  input: { degaussMethod: string; notes?: string },
  ip?: string,
): Promise<ErasureRequestSummary> {
  const doc = await ErasureRequestModel.findById(requestId);
  if (!doc) throw new NotFoundError("Erasure request not found");
  if (doc.status === "completed") {
    throw new ValidationError("Erasure request already completed");
  }
  if ((doc.matchedFileIds?.length ?? 0) === 0) {
    throw new ValidationError("No files matched — cannot complete erasure");
  }

  const method = input.degaussMethod.trim();
  if (!method) throw new ValidationError("degaussMethod is required");

  const fileIds = doc.matchedFileIds ?? [];
  await FileModel.updateMany(
    { _id: { $in: fileIds } },
    { $set: { status: "deleted" } },
  );

  const tech = await UserModel.findById(technicianId).lean();

  const cert = await issueDeletionCertificate({
    clientId: String(doc.clientId),
    erasureRequestId: String(doc._id),
    subjectId: String(doc.subjectId),
    fileIds: fileIds.map(String),
    technicianId,
    technicianEmail: tech?.email ?? technicianId,
    degaussMethod: method,
    userId: technicianId,
    ip,
  });

  doc.status = "completed";
  doc.completedBy = new Types.ObjectId(technicianId);
  doc.completedAt = new Date();
  doc.degaussMethod = method;
  doc.notes = input.notes?.trim();
  doc.certificateId = new Types.ObjectId(cert.id);
  await doc.save();

  await recordAuditEvent({
    action: "erasure.completed",
    userId: new Types.ObjectId(technicianId),
    clientId: doc.clientId as Types.ObjectId,
    ipAddress: ip,
    payload: {
      erasureRequestId: String(doc._id),
      subjectId: String(doc.subjectId),
      fileCount: fileIds.length,
      degaussMethod: method,
      certificateId: cert.id,
    },
  });

  return toSummary(doc);
}

export async function getErasureRequestForClient(
  clientId: string,
  requestId: string,
): Promise<ErasureRequestSummary> {
  const doc = await ErasureRequestModel.findOne({
    _id: new Types.ObjectId(requestId),
    clientId: new Types.ObjectId(clientId),
  }).lean();
  if (!doc) throw new NotFoundError("Erasure request not found");
  return toSummary(doc);
}
