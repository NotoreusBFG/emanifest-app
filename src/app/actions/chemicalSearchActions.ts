"use server";

import { searchSrsSubstances, type ChemicalSearchMatch } from "@/lib/hazmat/srsClient";
import { searchPubchemRcraRequirements, searchPubchemCharacteristicCodes } from "@/lib/hazmat/pubchemClient";
import { createClient } from "@/lib/supabase/server";
import { resolveEffectiveUserId } from "@/services/teamRepository";
import { cacheSearchResultIfMissing, parseWasteCodesText } from "@/services/customWasteCodeRepository";

export type ChemicalSearchState =
  | { success: true; matches: ChemicalSearchMatch[] }
  | { success: false; error: string };

/**
 * Public EPA/NLM lookups with no user data involved -- proxied server-side
 * to avoid cross-origin browser fetches to government domains (and keep
 * the raw-fetch clients, see srsClient.ts/pubchemClient.ts's caveats, off
 * the client bundle).
 *
 * Queries EPA's SRS and NLM's PubChem (HSDB-sourced RCRA "RCRA
 * Requirements" identity-based codes, PLUS Flash Point/pH literature
 * values evaluated against the D001/D002 numeric thresholds -- see
 * pubchemClient.ts's evaluateIgnitabilityAndCorrosivity) in parallel and
 * merges results. Confirmed live 2026-09-13 that neither SRS nor
 * PubChem's RCRA-Requirements section alone is sufficient: PubChem
 * catches real F-list codes SRS's own database is missing entirely (e.g.
 * toluene F005, cited to 40 CFR 261.31), while PubChem's HSDB coverage is
 * much narrower than SRS's (only a few thousand curated compounds, vs.
 * SRS's much larger registry) so most queries will only ever resolve via
 * SRS. The D001/D002 property check is a separate PubChem query (Flash
 * Point/pH sections exist independently of whether "RCRA Requirements"
 * does) added 2026-09-13 at the user's explicit request to auto-fill
 * these rather than only flag them -- see that function's doc comment
 * for the conservative-parsing and "pure compound, not your actual
 * waste" caveats that still apply even though this asserts the code.
 */
export async function searchChemicalWasteCodesAction(query: string): Promise<ChemicalSearchState> {
  const trimmed = query.trim();
  if (!trimmed) return { success: true, matches: [] };

  try {
    const [srsMatches, pubchemRcraResult, pubchemCharacteristicResult] = await Promise.all([
      searchSrsSubstances(trimmed).catch((): ChemicalSearchMatch[] => []),
      searchPubchemRcraRequirements(trimmed).catch(() => ({ codes: [], explanations: [] })),
      searchPubchemCharacteristicCodes(trimmed).catch(() => ({ codes: [], explanations: [] })),
    ]);

    const pubchemCodes = Array.from(new Set([...pubchemRcraResult.codes, ...pubchemCharacteristicResult.codes]));
    const pubchemExplanation = [...pubchemRcraResult.explanations, ...pubchemCharacteristicResult.explanations].join(" ");

    let matches: ChemicalSearchMatch[];
    if (srsMatches.length === 0) {
      // SRS didn't resolve this query at all (or errored) -- if PubChem
      // did, that's still a real, useful answer on its own.
      if (pubchemCodes.length === 0) return { success: true, matches: [] };
      matches = [
        {
          name: trimmed,
          casNumber: null,
          codes: pubchemCodes,
          hasUnconfirmedListing: false,
          explanation: pubchemExplanation,
        },
      ];
    } else {
      // Merge PubChem's codes/explanation into the first (closest-name)
      // SRS match only -- SRS can return multiple candidates for a loose
      // name query (e.g. "Acetone" also returning "Acenaphthylene"), and
      // PubChem resolved to exactly one compound, so it only ever
      // corroborates the single best match, not every candidate.
      matches = srsMatches.map((m, i) => {
        if (i !== 0 || pubchemCodes.length === 0) return m;
        return {
          ...m,
          codes: Array.from(new Set([...m.codes, ...pubchemCodes])),
          explanation: pubchemExplanation,
        };
      });
    }

    // Cache the single best (first) match into the user's own library so
    // this exact query never has to hit EPA/PubChem again -- see
    // cacheSearchResultIfMissing's doc comment for why only the top match
    // (never SRS's secondary loose candidates) and why it never overwrites
    // an existing row. Best-effort: an unauthenticated caller or a caching
    // failure never fails the search itself.
    const best = matches[0];
    if (best && best.codes.length > 0) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
        await cacheSearchResultIfMissing(supabase, effectiveUserId, {
          chemicalName: best.name,
          ...parseWasteCodesText(best.codes.join(", ")),
          notes: best.explanation ?? "",
        });
      }
    }

    return { success: true, matches };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "EPA lookup failed." };
  }
}
