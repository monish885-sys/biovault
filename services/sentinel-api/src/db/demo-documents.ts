import { createHash } from "node:crypto";

/** Small realistic stand-ins for archived files written to the tape simulator. */
export function generateDemoDocument(filename: string, fileType: string, category: string): Buffer {
  const tag = `# BioVault Sentinel demo archive\n# File: ${filename}\n# Category: ${category}\n`;
  const type = fileType.toLowerCase();

  switch (type) {
    case "pdf":
      return Buffer.from(
        `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Count 1 >> endobj\n${tag}Acme Hospital — archived clinical document (simulated)\n`,
        "utf8",
      );
    case "dcm":
      return Buffer.from(
        `DICM\0${tag}Modality: simulated\nStudy: ${filename}\nPatient ID: DEMO-ARCHIVE\n`,
        "utf8",
      );
    case "csv":
      return Buffer.from(
        `date,patient_id,test,result,unit\n2024-03-12,P-0312,glucose,92,mg/dL\n2024-03-12,P-0312,hemoglobin,13.8,g/dL\n${tag}`,
        "utf8",
      );
    case "json":
      return Buffer.from(
        JSON.stringify(
          {
            archive: "biovault-sentinel-demo",
            filename,
            category,
            recordType: "lab_result",
            patientId: "P-DEMO-0042",
            capturedAt: "2024-06-01T09:30:00Z",
          },
          null,
          2,
        ),
        "utf8",
      );
    case "xml":
      return Buffer.from(
        `<?xml version="1.0"?>\n<ClinicalRecord category="${category}">\n  <FileName>${filename}</FileName>\n  <Note>Simulated HL7/clinical XML archive</Note>\n</ClinicalRecord>\n`,
        "utf8",
      );
    case "txt":
      return Buffer.from(
        `${tag}Discharge summary excerpt (simulated)\nPatient seen for follow-up. Records archived per DPDPA retention policy.\n`,
        "utf8",
      );
    case "hl7":
      return Buffer.from(
        `MSH|^~\\&|ACME_LIS|ACME_HOSP|BIOVAULT|ARCHIVE|20240601093000||ORU^R01|DEMO001|P|2.5\nPID|1||P0042^^^ACME||DEMO^PATIENT\nOBR|1|||CBC^Complete Blood Count\n${tag}`,
        "utf8",
      );
    case "docx":
      return Buffer.from(
        `PK\x03\x04${tag}[Content_Types].xml — simulated Word document package (${filename})\n`,
        "utf8",
      );
    case "png":
      return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from(`${tag}PNG demo imaging thumbnail (simulated)\n`, "utf8"),
      ]);
    case "xlsx":
      return Buffer.from(
        `PK\x03\x04${tag}[workbook.xml] Simulated spreadsheet — billing export archive\n`,
        "utf8",
      );
    default:
      return Buffer.from(`${tag}Generic archived blob (${type})\n`, "utf8");
  }
}

export function demoDocumentChecksum(filename: string, fileType: string, category: string): string {
  const payload = generateDemoDocument(filename, fileType, category);
  return createHash("sha256").update(payload).digest("hex");
}

export function catalogSizeBytes(filename: string, fileType: string): number {
  const base = generateDemoDocument(filename, fileType, "catalog").length;
  const multipliers: Record<string, number> = {
    dcm: 1_200_000,
    pdf: 45_000,
    png: 8_000,
    xlsx: 12_000,
  };
  return Math.max(base, Math.round(base * (multipliers[fileType] ?? 500)));
}
