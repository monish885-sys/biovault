import { Schema, model, type InferSchemaType, Types } from "mongoose";

const fileSchema = new Schema(
  {
    clientId: { type: Types.ObjectId, ref: "Client", required: true, index: true },
    ingestJobId: { type: Types.ObjectId, ref: "IngestJob", index: true },
    filename: { type: String, required: true, index: true },
    fileType: { type: String, required: true },
    category: { type: String, required: true, index: true },
    sizeBytes: { type: Number, required: true },
    checksumSha256: { type: String, required: true },
    modifiedAt: { type: Date },
    keywordMetadata: { type: Map, of: String },
    status: {
      type: String,
      enum: ["indexing", "on_tape", "pending_deletion", "deleted"],
      default: "indexing",
      index: true,
    },
  },
  { timestamps: true },
);

fileSchema.index({ clientId: 1, filename: 1 });
fileSchema.index({ clientId: 1, category: 1, createdAt: -1 });

export type FileDocument = InferSchemaType<typeof fileSchema>;
export const FileModel = model("File", fileSchema);
