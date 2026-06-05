import { Schema, model, type InferSchemaType, Types } from "mongoose";

const certificateSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["ingest_summary", "deletion_confirmation", "audit_export"],
      required: true,
    },
    clientId: { type: Types.ObjectId, ref: "Client", required: true, index: true },
    pdfStorageRef: { type: String, required: true },
    pdfSha256: { type: String, required: true },
    issuedAt: { type: Date, default: () => new Date() },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export type CertificateDocument = InferSchemaType<typeof certificateSchema>;
export const CertificateModel = model("Certificate", certificateSchema);
