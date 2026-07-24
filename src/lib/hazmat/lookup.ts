import table from "./table.json";
import type { HazmatEntry } from "./types";

const entries = table as HazmatEntry[];

/**
 * Substring search over proper shipping names. Cross-reference-only rows
 * (see `HazmatEntry.isCrossReference`) are excluded since they carry no
 * actual hazard classification to put on a waste line.
 */
export function searchHazmatEntries(query: string, limit = 20): HazmatEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: HazmatEntry[] = [];
  for (const entry of entries) {
    if (entry.isCrossReference) continue;
    if (entry.properShippingName.toLowerCase().includes(q)) {
      results.push(entry);
      if (results.length >= limit) break;
    }
  }
  return results;
}
