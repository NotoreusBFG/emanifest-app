import type { ImportedManifestPayload, ImportedTransporter, ImportedWasteLine, ManifestImportResult } from "./types";

/** The CSV column headers this importer expects -- one row per waste
 * line, with generator/transporter/facility fields repeated on every row
 * (the common shape for a flat ERP/LIMS export). Also used to generate
 * the downloadable template. */
export const CSV_COLUMNS = [
  "generatorEpaSiteId",
  "generatorName",
  "transporter1EpaSiteId",
  "transporter1Name",
  "transporter2EpaSiteId",
  "transporter2Name",
  "designatedFacilityEpaSiteId",
  "designatedFacilityName",
  "wasteDescription",
  "dotHazardous",
  "hazardClass",
  "packingGroup",
  "idNumberCode",
  "rqIndicator",
  "quantity",
  "unitCode",
  "containerNumber",
  "containerTypeCode",
  "federalWasteCodes",
] as const;

const REQUIRED_COLUMNS: (typeof CSV_COLUMNS)[number][] = [
  "generatorEpaSiteId",
  "designatedFacilityEpaSiteId",
  "wasteDescription",
  "quantity",
  "unitCode",
  "containerNumber",
  "containerTypeCode",
];

/** Minimal RFC-4180-ish CSV line splitter -- handles double-quoted fields
 * that contain commas or escaped ("") quotes, since waste descriptions
 * routinely contain commas (e.g. "Waste flammable liquids, n.o.s."). Not a
 * full CSV spec implementation (no multi-line quoted fields), which is
 * fine for a flat one-row-per-waste-line export. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["true", "yes", "1", "y"].includes(value.trim().toLowerCase());
}

function parseWasteCodes(value: string | undefined): string[] | undefined {
  if (!value || !value.trim()) return undefined;
  // Semicolon-separated within the cell -- a plain comma would collide
  // with CSV's own field delimiter.
  return value
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function parseManifestImportCsv(text: string): ManifestImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { success: false, errors: ["File must have a header row plus at least one waste line row."] };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const missingRequired = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missingRequired.length > 0) {
    return { success: false, errors: [`Missing required column(s): ${missingRequired.join(", ")}.`] };
  }

  const errors: string[] = [];
  const wastes: ImportedWasteLine[] = [];
  let generatorEpaSiteId = "";
  let generatorName: string | undefined;
  let designatedFacilityEpaSiteId = "";
  let designatedFacilityName: string | undefined;
  const transporterMap = new Map<string, string | undefined>(); // epaSiteId -> name

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const rowNumber = rowIndex + 1; // 1-indexed, matching what a spreadsheet shows
    const values = splitCsvLine(lines[rowIndex]);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ""));

    if (!row.generatorEpaSiteId) {
      errors.push(`Row ${rowNumber}: missing generatorEpaSiteId.`);
      continue;
    }
    if (!row.designatedFacilityEpaSiteId) {
      errors.push(`Row ${rowNumber}: missing designatedFacilityEpaSiteId.`);
      continue;
    }
    if (!row.wasteDescription) {
      errors.push(`Row ${rowNumber}: missing wasteDescription.`);
      continue;
    }
    const quantity = Number(row.quantity);
    const containerNumber = Number(row.containerNumber);
    if (!quantity || quantity <= 0) {
      errors.push(`Row ${rowNumber}: quantity must be a positive number.`);
      continue;
    }
    if (!containerNumber || containerNumber <= 0) {
      errors.push(`Row ${rowNumber}: containerNumber must be a positive number.`);
      continue;
    }
    if (!row.unitCode || !row.containerTypeCode) {
      errors.push(`Row ${rowNumber}: unitCode and containerTypeCode are required.`);
      continue;
    }

    // First row's party info wins -- later rows are expected to repeat the
    // same values (this is one manifest per import), but we don't hard-fail
    // on inconsistency since that's more likely a copy-paste artifact than
    // a real second manifest.
    if (!generatorEpaSiteId) {
      generatorEpaSiteId = row.generatorEpaSiteId;
      generatorName = row.generatorName || undefined;
    }
    if (!designatedFacilityEpaSiteId) {
      designatedFacilityEpaSiteId = row.designatedFacilityEpaSiteId;
      designatedFacilityName = row.designatedFacilityName || undefined;
    }
    if (row.transporter1EpaSiteId && !transporterMap.has(row.transporter1EpaSiteId)) {
      transporterMap.set(row.transporter1EpaSiteId, row.transporter1Name || undefined);
    }
    if (row.transporter2EpaSiteId && !transporterMap.has(row.transporter2EpaSiteId)) {
      transporterMap.set(row.transporter2EpaSiteId, row.transporter2Name || undefined);
    }

    wastes.push({
      description: row.wasteDescription,
      dotHazardous: parseBoolean(row.dotHazardous),
      hazardClass: row.hazardClass || undefined,
      packingGroup: row.packingGroup || undefined,
      idNumberCode: row.idNumberCode || undefined,
      rqIndicator: row.rqIndicator ? parseBoolean(row.rqIndicator) : undefined,
      quantity,
      unitCode: row.unitCode,
      containerNumber,
      containerTypeCode: row.containerTypeCode,
      federalWasteCodes: parseWasteCodes(row.federalWasteCodes),
    });
  }

  if (errors.length > 0) return { success: false, errors };
  if (wastes.length === 0) return { success: false, errors: ["No valid waste line rows found."] };

  const transporters: ImportedTransporter[] = Array.from(transporterMap.entries()).map(([epaSiteId, name], i) => ({
    epaSiteId,
    name,
    order: i + 1,
  }));

  return {
    success: true,
    payload: {
      generator: { epaSiteId: generatorEpaSiteId, name: generatorName },
      transporters,
      designatedFacility: { epaSiteId: designatedFacilityEpaSiteId, name: designatedFacilityName },
      wastes,
    },
  };
}

export function parseManifestImportJson(text: string): ManifestImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { success: false, errors: ["File is not valid JSON."] };
  }

  if (typeof data !== "object" || data === null) {
    return { success: false, errors: ["JSON must be an object matching the ImportedManifestPayload shape."] };
  }

  const payload = data as Partial<ImportedManifestPayload>;
  const errors: string[] = [];

  if (!payload.generator?.epaSiteId) errors.push("generator.epaSiteId is required.");
  if (!payload.designatedFacility?.epaSiteId) errors.push("designatedFacility.epaSiteId is required.");
  if (!Array.isArray(payload.wastes) || payload.wastes.length === 0) {
    errors.push("wastes must be a non-empty array.");
  } else {
    payload.wastes.forEach((w, i) => {
      if (!w.description) errors.push(`wastes[${i}]: description is required.`);
      if (!w.quantity || w.quantity <= 0) errors.push(`wastes[${i}]: quantity must be a positive number.`);
      if (!w.unitCode) errors.push(`wastes[${i}]: unitCode is required.`);
      if (!w.containerNumber || w.containerNumber <= 0) errors.push(`wastes[${i}]: containerNumber must be a positive number.`);
      if (!w.containerTypeCode) errors.push(`wastes[${i}]: containerTypeCode is required.`);
    });
  }
  if (payload.transporters && !Array.isArray(payload.transporters)) {
    errors.push("transporters must be an array.");
  }

  if (errors.length > 0) return { success: false, errors };

  return {
    success: true,
    payload: {
      generator: payload.generator!,
      transporters: (payload.transporters ?? []).map((t, i) => ({ ...t, order: t.order ?? i + 1 })),
      designatedFacility: payload.designatedFacility!,
      wastes: payload.wastes!,
    },
  };
}

export function parseManifestImportFile(filename: string, text: string): ManifestImportResult {
  if (filename.toLowerCase().endsWith(".json")) return parseManifestImportJson(text);
  if (filename.toLowerCase().endsWith(".csv")) return parseManifestImportCsv(text);
  return { success: false, errors: ["Unsupported file type -- please upload a .csv or .json file."] };
}
