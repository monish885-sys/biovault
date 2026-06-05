import { Schema, model, type InferSchemaType, Types } from "mongoose";

const RETRIEVAL_STATUSES = [
  "pending",
  "assigned",
  "in_progress",
  "ready",
  "delivered",
  "expired",
  "failed",
] as const;

const retrievalJobSchema = new Schema(
  {
    clientId: { type: Types.ObjectId, ref: "Client", required: true, index: true },
    fileId: { type: Types.ObjectId, ref: "File", required: true },
    requestedBy: { type: Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: RETRIEVAL_STATUSES,
      default: "pending",
      index: true,
    },
    dueAt: { type: Date, required: true, index: true },
    assignedTo: { type: Types.ObjectId, ref: "User" },
    downloadToken: { type: String },
    downloadExpiresAt: { type: Date },
    stagingPath: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

export type RetrievalJobDocument = InferSchemaType<typeof retrievalJobSchema>;
export const RetrievalJobModel = model("RetrievalJob", retrievalJobSchema);
