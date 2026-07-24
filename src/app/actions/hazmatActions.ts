"use server";

import { searchHazmatEntries } from "@/lib/hazmat/lookup";
import type { HazmatEntry } from "@/lib/hazmat/types";

/**
 * Called directly from the waste-line hazmat autocomplete (not a
 * <form action>). Unlike `searchSitesAction`, this doesn't touch RCRAInfo
 * or need a logged-in user — it's a local lookup over the parsed §172.101
 * table (`src/lib/hazmat/table.json`), kept server-side only so that data
 * (~2MB) isn't shipped to the client bundle.
 */
export async function searchHazmatAction(query: string): Promise<HazmatEntry[]> {
  return searchHazmatEntries(query);
}
