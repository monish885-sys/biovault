import { createLogger } from "@biovault/common";
import { config } from "../config.js";
import { connectMongo, disconnectMongo } from "./connect.js";
import "./schemas/index.js";

const log = createLogger("migrate", config.logLevel);

async function main() {
  await connectMongo();
  log.info("schema sync complete (Mongoose models registered)");
  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
