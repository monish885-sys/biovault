import { mkdir } from "node:fs/promises";
import { createLogger } from "@biovault/common";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectMongo } from "./db/connect.js";
import "./db/schemas/index.js";
import { getRedis } from "./redis.js";

const log = createLogger("sentinel-api", config.logLevel);

async function main() {
  await mkdir(config.stagingPath, { recursive: true });
  await connectMongo();
  getRedis();

  const app = createApp();
  app.listen(config.port, () => {
    log.info("listening", { port: config.port, tapeAdapter: config.tapeAdapter });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
