import { Schema, model, type InferSchemaType } from "mongoose";

const tapeSchema = new Schema(
  {
    barcode: { type: String, required: true, unique: true, index: true },
    rack: { type: String, required: true },
    slot: { type: String, required: true },
    status: {
      type: String,
      enum: ["empty", "writing", "active", "full", "retired"],
      default: "empty",
      index: true,
    },
    fillPercent: { type: Number, default: 0, min: 0, max: 100 },
    healthScore: {
      type: String,
      enum: ["green", "amber", "red"],
      default: "green",
    },
    writeCycles: { type: Number, default: 0 },
    sealedAt: { type: Date },
    purchasedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

export type TapeDocument = InferSchemaType<typeof tapeSchema>;
export const TapeModel = model("Tape", tapeSchema);
