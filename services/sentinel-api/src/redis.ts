import { Redis } from "ioredis";
import { createLogger } from "@biovault/common";
import { config } from "./config.js";

const log = createLogger("redis", config.logLevel);

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    client.on("error", (err: Error) => log.error("redis error", { err: String(err) }));
  }
  return client;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const pong = await getRedis().ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
