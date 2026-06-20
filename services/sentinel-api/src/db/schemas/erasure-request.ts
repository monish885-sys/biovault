import { Schema, model, type InferSchemaType, Types } from "mongoose";

const ERASURE_STATUSES = [
  "pending",
  "locating",
  "awaiting_degauss",
  "completed",
  "failed",
] as const;

const erasureRequestSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subjectId: { type: String, required: true, index: true },
    reason: { type: String, required: true },
    searchQuery: { type: String, required: true },
    status: {
      type: String,
      enum: ERASURE_STATUSES,
      default: "pending",
      index: true,
    },
    matchedFileIds: { type: [Schema.Types.ObjectId], ref: "File", default: [] },
    affectedTapeBarcodes: { type: [String], default: [] },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    completedAt: { type: Date },
    degaussMethod: { type: String },
    notes: { type: String },
    certificateId: { type: Schema.Types.ObjectId, ref: "Certificate" },
  },
  { timestamps: true },
);

export type ErasureRequestDocument = InferSchemaType<typeof erasureRequestSchema>;
export const ErasureRequestModel = model("ErasureRequest", erasureRequestSchema);
