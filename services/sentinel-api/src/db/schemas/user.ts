import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const CLIENT_ROLES = ["client_admin", "client_viewer", "compliance_officer"] as const;
export const INTERNAL_ROLES = ["ops_admin", "technician"] as const;
export const ALL_ROLES = [...CLIENT_ROLES, ...INTERNAL_ROLES] as const;

export type UserRole = (typeof ALL_ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ALL_ROLES, required: true },
    clientId: { type: Types.ObjectId, ref: "Client", index: true },
    mfaEnabled: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = model("User", userSchema);
