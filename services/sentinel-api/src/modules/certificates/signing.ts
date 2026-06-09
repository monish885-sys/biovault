import {
  createPrivateKey,
  createSign,
  generateKeyPairSync,
  sign as edSign,
} from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { config } from "../../config.js";

let cachedKeyPem: string | null = null;

export async function loadSigningKey(): Promise<string> {
  if (cachedKeyPem) return cachedKeyPem;

  const configured = config.certSigningKeyPath;
  if (configured && existsSync(configured)) {
    cachedKeyPem = await readFile(configured, "utf8");
    return cachedKeyPem;
  }

  const devKeyPath = join(config.stagingPath, ".dev-cert-signing.pem");
  if (existsSync(devKeyPath)) {
    cachedKeyPem = await readFile(devKeyPath, "utf8");
    return cachedKeyPem;
  }

  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  await mkdir(dirname(devKeyPath), { recursive: true });
  await writeFile(devKeyPath, pem, { mode: 0o600 });
  cachedKeyPem = pem;
  return pem;
}

export async function signBuffer(
  data: Buffer,
): Promise<{ algorithm: string; signature: string }> {
  const keyPem = await loadSigningKey();
  const key = createPrivateKey(keyPem);
  const keyType = key.asymmetricKeyType;

  if (keyType === "ed25519") {
    const signature = edSign(null, data, key).toString("base64");
    return { algorithm: "Ed25519", signature };
  }

  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const signature = signer.sign(keyPem, "base64");
  return { algorithm: "RSA-SHA256", signature };
}
