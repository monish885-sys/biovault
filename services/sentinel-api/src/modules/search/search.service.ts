import { Types } from "mongoose";
import { ValidationError } from "@biovault/common";
import { FileModel } from "../../db/schemas/file.js";
import { tokenizeSearchText } from "../../search/tokens.js";

export type ClientFileSearchResult = {
  id: string;
  filename: string;
  fileType: string;
  category: string;
  ingestedAt: string;
};

export type SearchFilesParams = {
  q?: string;
  from?: string;
  to?: string;
  fileType?: string;
  category?: string;
  limit?: number;
  offset?: number;
};

export type FileSearchResponse = {
  files: ClientFileSearchResult[];
  total: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseDateParam(value: string, label: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${label} must be a valid ISO date (YYYY-MM-DD)`);
  }
  return parsed;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), MAX_LIMIT);
}

function clampOffset(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return 0;
  return Math.max(Math.trunc(raw), 0);
}

/** Client search — tenant-scoped, archived files only, no tape location fields. */
export async function searchClientFiles(
  clientId: string,
  params: SearchFilesParams,
): Promise<FileSearchResponse> {
  const filter: Record<string, unknown> = {
    clientId: new Types.ObjectId(clientId),
    status: "on_tape",
  };

  const category = params.category?.trim();
  if (category) {
    filter.category = category;
  }

  const fileType = params.fileType?.trim().toLowerCase();
  if (fileType) {
    filter.fileType = fileType;
  }

  if (params.from || params.to) {
    const createdAt: Record<string, Date> = {};
    if (params.from) {
      createdAt.$gte = startOfUtcDay(parseDateParam(params.from, "from"));
    }
    if (params.to) {
      createdAt.$lte = endOfUtcDay(parseDateParam(params.to, "to"));
    }
    if (params.from && params.to && createdAt.$gte! > createdAt.$lte!) {
      throw new ValidationError("from must be on or before to");
    }
    filter.createdAt = createdAt;
  }

  const query = params.q?.trim();
  if (query) {
    const tokens = tokenizeSearchText(query, clientId);
    if (tokens.length === 0) {
      return { files: [], total: 0 };
    }
    filter.$and = tokens.map((token) => ({
      $or: [{ filenameSearchTokens: token }, { keywordSearchTokens: token }],
    }));
  }

  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);

  const [docs, total] = await Promise.all([
    FileModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .select("filename fileType category createdAt")
      .lean(),
    FileModel.countDocuments(filter),
  ]);

  return {
    files: docs.map((doc) => ({
      id: String(doc._id),
      filename: doc.filename,
      fileType: doc.fileType,
      category: doc.category,
      ingestedAt: (doc.createdAt ?? new Date()).toISOString(),
    })),
    total,
  };
}
