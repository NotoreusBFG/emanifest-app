import table from "./table.json";
import type { HazmatEntry } from "./types";

const entries = table as HazmatEntry[];

/**
 * Substring search over proper shipping names AND DOT ID numbers (e.g.
 * typing "UN1993" finds the same entries as typing "flammable liquids") —
 * since the ID number field in the manifest form is now read-only, derived
 * only from a selected entry, someone who already knows their ID number
 * needs to be able to search by it directly. Cross-reference-only rows
 * (see `HazmatEntry.isCrossReference`) are excluded since they carry no
 * actual hazard classification to put on a waste line.
 */
export function searchHazmatEntries(query: string, limit = 20): HazmatEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: HazmatEntry[] = [];
  for (const entry of entries) {
    if (entry.isCrossReference) continue;
    if (
      entry.properShippingName.toLowerCase().includes(q) ||
      entry.idNumbers.toLowerCase().includes(q)
    ) {
      results.push(entry);
      if (results.length >= limit) break;
    }
  }
  return results;
}
