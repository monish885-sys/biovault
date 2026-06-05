import { Schema, model, type InferSchemaType, Types } from "mongoose";

const fileLocationSchema = new Schema(
  {
    fileId: { type: Types.ObjectId, ref: "File", required: true, unique: true },
    tapeBarcode: { type: String, required: true, index: true },
    blockId: { type: String, required: true },
    byteOffset: { type: Number, required: true },
  },
  { timestamps: true },
);

export type FileLocationDocument = InferSchemaType<typeof fileLocationSchema>;
export const FileLocationModel = model("FileLocation", fileLocationSchema);
