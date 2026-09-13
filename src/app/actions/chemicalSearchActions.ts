"use server";

import { searchSrsSubstances, type ChemicalSearchMatch } from "@/lib/hazmat/srsClient";
import { searchPubchemRcraRequirements } from "@/lib/hazmat/pubchemClient";

export type ChemicalSearchState =
  | { success: true; matches: ChemicalSearchMatch[] }
  | { success: false; error: string };

/**
 * Public EPA/NLM lookups with no user data involved -- proxied server-side
 * to avoid cross-origin browser fetches to government domains (and keep
 * the raw-fetch clients, see srsClient.ts/pubchemClient.ts's caveats, off
 * the client bundle).
 *
 * Queries EPA's SRS and NLM's PubChem (HSDB-sourced RCRA data) in
 * parallel and merges results -- confirmed live 2026-09-13 that neither
 * source alone is sufficient: PubChem catches real F-list codes SRS's
 * own database is missing entirely (e.g. toluene F005, cited to 40 CFR
 * 261.31), while PubChem's HSDB coverage is much narrower than SRS's
 * (only a few thousand curated compounds, vs. SRS's much larger
 * registry) so most queries will only ever resolve via SRS.
 */
export async function searchChemicalWasteCodesAction(query: string): Promise<ChemicalSearchState> {
  const trimmed = query.trim();
  if (!trimmed) return { success: true, matches: [] };

  try {
    const [srsMatches, pubchemResult] = await Promise.all([
      searchSrsSubstances(trimmed).catch((): ChemicalSearchMatch[] => []),
      searchPubchemRcraRequirements(trimmed).catch(() => ({ codes: [], explanations: [] })),
    ]);

    if (srsMatches.length === 0) {
      // SRS didn't resolve this query at all (or errored) -- if PubChem
      // did, that's still a real, useful answer on its own.
      if (pubchemResult.codes.length === 0) return { success: true, matches: [] };
      return {
        success: true,
        matches: [
          {
            name: trimmed,
            casNumber: null,
            codes: pubchemResult.codes,
            hasUnconfirmedListing: false,
            explanation: pubchemResult.explanations.join(" "),
          },
        ],
      };
    }

    // Merge PubChem's codes/explanation into the first (closest-name)
    // SRS match only -- SRS can return multiple candidates for a loose
    // name query (e.g. "Acetone" also returning "Acenaphthylene"), and
    // PubChem resolved to exactly one compound, so it only ever
    // corroborates the single best match, not every candidate.
    const merged = srsMatches.map((m, i) => {
      if (i !== 0 || pubchemResult.codes.length === 0) return m;
      return {
        ...m,
        codes: Array.from(new Set([...m.codes, ...pubchemResult.codes])),
        explanation: pubchemResult.explanations.join(" "),
      };
    });

    return { success: true, matches: merged };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "EPA lookup failed." };
  }
}
