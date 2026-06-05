import mongoose from "mongoose";
import { createLogger } from "@biovault/common";
import { config } from "../config.js";

const log = createLogger("mongodb", config.logLevel);

export async function connectMongo(): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongoUri);
  log.info("connected", { uri: config.mongoUri.replace(/\/\/.*@/, "//***@") });
  return mongoose;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  log.info("disconnected");
}

export function mongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}
