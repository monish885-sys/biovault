import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type IngestCertificateContent = {
  clientName: string;
  jobId: string;
  sealedAt: string;
  fileCount: number;
  totalBytes: number;
  files: Array<{
    filename: string;
    checksumSha256: string;
    verified: boolean;
  }>;
  pdfSha256: string;
  algorithm: string;
  signature: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function buildIngestCertificatePdf(
  content: IngestCertificateContent,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595, 842]);
  let y = 800;
  const margin = 50;
  const lineHeight = 16;

  const draw = (text: string, opts?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }) => {
    const size = opts?.size ?? 11;
    const font = opts?.bold ? bold : regular;
    if (y < 80) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(text, {
      x: margin,
      y,
      size,
      font,
      color: opts?.color ?? rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight + (opts?.size && opts.size > 11 ? 4 : 0);
  };

  draw("BioVault Sentinel — Ingest Confirmation Certificate", { bold: true, size: 16 });
  y -= 8;
  draw(`Client: ${content.clientName}`);
  draw(`Ingest Job: ${content.jobId}`);
  draw(`Sealed At: ${content.sealedAt}`);
  draw(`Files: ${content.fileCount}  |  Total: ${formatBytes(content.totalBytes)}`);
  y -= 8;
  draw("Indexed Files (SHA-256 verified on tape read-back)", { bold: true });

  for (const file of content.files) {
    const status = file.verified ? "verified" : "unverified";
    draw(`• ${file.filename} [${status}]`);
    draw(`  ${file.checksumSha256}`, { size: 9 });
  }

  y -= 12;
  draw("Digital Signature", { bold: true });
  draw(`Algorithm: ${content.algorithm}`);
  draw(`Document SHA-256: ${content.pdfSha256}`);
  draw(`Signature (base64): ${content.signature.slice(0, 64)}…`, { size: 9 });

  y -= 12;
  draw(
    "This certificate confirms that listed files were indexed, written to LTO-9 media, and verified by read-back checksum.",
    { size: 9, color: rgb(0.35, 0.35, 0.35) },
  );

  return doc.save();
}
