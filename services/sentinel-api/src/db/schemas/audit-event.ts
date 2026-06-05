import { Schema, model, type InferSchemaType, Types } from "mongoose";

const auditEventSchema = new Schema(
  {
    action: { type: String, required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User" },
    clientId: { type: Types.ObjectId, ref: "Client", index: true },
    ipAddress: { type: String },
    payload: { type: Schema.Types.Mixed },
    payloadHash: { type: String, required: true },
    prevHash: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditEventSchema.index({ createdAt: -1 });

export type AuditEventDocument = InferSchemaType<typeof auditEventSchema>;
export const AuditEventModel = model("AuditEvent", auditEventSchema);
