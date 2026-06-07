import Busboy from "busboy";
import type { Request } from "express";
import type { Readable } from "node:stream";
import { ValidationError } from "@biovault/common";
import { writeStagedFile } from "./staging.js";

export type StagedUpload = {
  fieldname: string;
  filename: string;
  mimeType: string;
  checksumSha256: string;
  sizeBytes: number;
};

export type ParsedMultipart = {
  fields: Record<string, string>;
  files: StagedUpload[];
};

export function parseMultipart(req: Request, ingestJobId: string): Promise<ParsedMultipart> {
  const contentType = req.headers["content-type"];
  if (!contentType?.includes("multipart/form-data")) {
    return Promise.reject(new ValidationError("Content-Type must be multipart/form-data"));
  }

  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    const files: StagedUpload[] = [];
    const pending: Promise<void>[] = [];

    const busboy = Busboy({ headers: req.headers, limits: { files: 50, fileSize: 512 * 1024 * 1024 } });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (fieldname, stream, info) => {
      const filename = info.filename;
      pending.push(
        writeStagedFile(ingestJobId, filename, stream as Readable)
          .then((result) => {
            files.push({
              fieldname,
              filename,
              mimeType: info.mimeType,
              checksumSha256: result.checksumSha256,
              sizeBytes: result.sizeBytes,
            });
          })
          .catch(reject),
      );
    });

    busboy.on("error", reject);
    busboy.on("finish", () => {
      Promise.all(pending)
        .then(() => {
          if (files.length === 0) {
            reject(new ValidationError("At least one file is required"));
            return;
          }
          resolve({ fields, files });
        })
        .catch(reject);
    });

    req.pipe(busboy);
  });
}
