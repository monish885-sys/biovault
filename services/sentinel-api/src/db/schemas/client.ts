import { Schema, model, type InferSchemaType } from "mongoose";

const clientSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    tier: {
      type: String,
      enum: ["base", "standard", "enterprise"],
      default: "base",
    },
    retentionPolicyYears: { type: Number, default: 7 },
    dataCategories: [{ type: String }],
    onboardingComplete: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type ClientDocument = InferSchemaType<typeof clientSchema>;
export const ClientModel = model("Client", clientSchema);
