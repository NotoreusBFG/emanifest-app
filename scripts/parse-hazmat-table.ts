/**
 * One-off parser: extracts the 49 CFR §172.101 Hazardous Materials Table
 * from the downloaded eCFR XML (`src/title-49.xml`) into structured JSON
 * at `src/lib/hazmat/table.json`. Not run at build/request time — rerun
 * manually (`npx tsx scripts/parse-hazmat-table.ts`) only if the source
 * XML is ever refreshed from eCFR.
 *
 * The table's markup is plain, consistent HTML-style XML (TABLE/TBODY/TR/TD,
 * confirmed via direct inspection: every one of the 3687 body rows has
 * exactly 14 TD cells, matching the 14 numbered columns (1)-(10B)), so a
 * small regex-based extraction is reliable here without pulling in an XML
 * parsing dependency.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { HazmatEntry } from "../src/lib/hazmat/types";

const SOURCE_PATH = join(__dirname, "../src/title-49.xml");
const OUTPUT_PATH = join(__dirname, "../src/lib/hazmat/table.json");
const CAPTION_MARKER = '<CAPTION><P class="title">§ 172.101 Hazardous Materials Table</P></CAPTION>';
const EXPECTED_COLUMN_COUNT = 14;

function stripTags(cell: string): string {
  return cell
    .replace(/<br\s*\/?>(<\/br>)?/gi, " ")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "") // drop remaining tags (E, sup, etc.) but keep their text content
    .replace(/\s+/g, " ")
    .trim();
}

function parseRow(rowHtml: string): HazmatEntry {
  const cellMatches = [...rowHtml.matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/g)];
  if (cellMatches.length !== EXPECTED_COLUMN_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_COLUMN_COUNT} TD cells, got ${cellMatches.length}. Row: ${rowHtml.slice(0, 200)}`
    );
  }
  const cells = cellMatches.map((m) => stripTags(m[1]));

  const [
    symbols,
    properShippingName,
    hazardClass,
    idNumbers,
    packingGroup,
    labelCodes,
    specialProvisions,
    packagingExceptions,
    packagingNonBulk,
    packagingBulk,
    quantityPassengerAircraftRail,
    quantityCargoAircraftOnly,
    vesselStowageLocation,
    vesselStowageOther,
  ] = cells;

  return {
    symbols,
    properShippingName,
    hazardClass,
    idNumbers,
    packingGroup,
    labelCodes,
    specialProvisions,
    packaging: {
      exceptions: packagingExceptions,
      nonBulk: packagingNonBulk,
      bulk: packagingBulk,
    },
    quantityLimitations: {
      passengerAircraftRail: quantityPassengerAircraftRail,
      cargoAircraftOnly: quantityCargoAircraftOnly,
    },
    vesselStowage: {
      location: vesselStowageLocation,
      other: vesselStowageOther,
    },
    // No hazard class/ID number of its own means this row is just an
    // alphabetized pointer to the real entry under another name (e.g.
    // "Accellerene, see p-Nitrosodimethylaniline").
    isCrossReference: hazardClass === "" && idNumbers === "",
  };
}

function main() {
  const xml = readFileSync(SOURCE_PATH, "utf-8");

  const captionIndex = xml.indexOf(CAPTION_MARKER);
  if (captionIndex === -1) throw new Error("Could not find §172.101 table caption in source XML.");

  const tableStart = xml.lastIndexOf("<TABLE", captionIndex);
  const tableEnd = xml.indexOf("</TABLE>", captionIndex) + "</TABLE>".length;
  const tableHtml = xml.slice(tableStart, tableEnd);

  const bodyStart = tableHtml.indexOf("<TBODY>") + "<TBODY>".length;
  const bodyEnd = tableHtml.indexOf("</TBODY>");
  const bodyHtml = tableHtml.slice(bodyStart, bodyEnd);

  const rowMatches = [...bodyHtml.matchAll(/<TR>([\s\S]*?)<\/TR>/g)];
  const entries: HazmatEntry[] = rowMatches.map((m) => parseRow(m[1]));

  const crossReferenceCount = entries.filter((e) => e.isCrossReference).length;
  console.log(`Parsed ${entries.length} rows (${crossReferenceCount} cross-reference-only, ${entries.length - crossReferenceCount} with hazard data).`);

  writeFileSync(OUTPUT_PATH, JSON.stringify(entries, null, 2));
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
