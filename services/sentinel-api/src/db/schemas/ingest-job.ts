import { Schema, model, type InferSchemaType, Types } from "mongoose";

const INGEST_STATUSES = [
  "received",
  "indexing",
  "writing",
  "verifying",
  "sealed",
  "failed",
] as const;

const ingestJobSchema = new Schema(
  {
    clientId: { type: Types.ObjectId, ref: "Client", required: true, index: true },
    status: { type: String, enum: INGEST_STATUSES, default: "received", index: true },
    tapeBarcode: { type: String },
    fileCount: { type: Number, default: 0 },
    totalBytes: { type: Number, default: 0 },
    errorMessage: { type: String },
    sealedAt: { type: Date },
  },
  { timestamps: true },
);

export type IngestJobDocument = InferSchemaType<typeof ingestJobSchema>;
export const IngestJobModel = model("IngestJob", ingestJobSchema);
