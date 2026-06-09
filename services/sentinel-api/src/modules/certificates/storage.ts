import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { config } from "../../config.js";

export function certificatePdfPath(certificateId: string): string {
  return join(config.stagingPath, "certificates", `${certificateId}.pdf`);
}

export async function writeCertificatePdf(
  certificateId: string,
  bytes: Uint8Array,
): Promise<string> {
  const path = certificatePdfPath(certificateId);
  await mkdir(join(config.stagingPath, "certificates"), { recursive: true });
  await writeFile(path, bytes);
  return path;
}

export async function readCertificatePdf(certificateId: string): Promise<Buffer> {
  return readFile(certificatePdfPath(certificateId));
}
