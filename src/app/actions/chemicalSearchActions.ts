"use server";

import { searchSrsSubstances, type ChemicalSearchMatch } from "@/lib/hazmat/srsClient";

export type ChemicalSearchState =
  | { success: true; matches: ChemicalSearchMatch[] }
  | { success: false; error: string };

/** Public EPA lookup with no user data involved -- proxied server-side to
 * avoid a cross-origin browser fetch to a government domain (and keep the
 * raw-fetch SRS client, see srsClient.ts's caveats, off the client bundle). */
export async function searchChemicalWasteCodesAction(query: string): Promise<ChemicalSearchState> {
  if (!query.trim()) return { success: true, matches: [] };

  try {
    const matches = await searchSrsSubstances(query);
    return { success: true, matches };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "EPA lookup failed." };
  }
}
