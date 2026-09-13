/**
 * Dependency-free client for EPA's Substance Registry Services (SRS) REST
 * API -- public, no API key. Confirmed live 2026-09-13 against real
 * chemicals (acetone CAS 67-64-1, toluene CAS 108-88-3).
 *
 * Real endpoint shape (not in any reachable Swagger JSON -- the frontend
 * at cdxapps.epa.gov serves an SPA shell for every doc path tried;
 * reverse-engineered instead from the `webchem` R package's srs_query
 * source, https://github.com/ropensci/webchem/blob/master/R/srs.R):
 *   GET https://cdxapps.epa.gov/oms-substance-registry-services/rest-api/substance/{from}/{query}
 *   from: "cas" | "name" (also itn/epaid/tsn, unused here)
 * Returns a JSON array (never a single object), or the literal string
 * "[]" if nothing matches.
 *
 * IMPORTANT caveats confirmed by live testing, not assumed -- see
 * private-notes NEXT_SESSION.md for the earlier unconfirmed research this
 * replaces:
 * - Name search requires a close-to-complete/correct name -- there is no
 *   prefix/wildcard matching ("acet" returns nothing; "Acetone" works).
 *   Never wire this to a per-keystroke typeahead; only an explicit
 *   on-demand lookup (a button/Enter), same as this module's callers do.
 * - RCRA waste codes appear at
 *   `synonyms[].alternateIds[].alternateIdTypeName === "RCRA Hazardous Waste Code"`,
 *   with the real code (e.g. "U002") in `.alternateId` -- but this is only
 *   ever populated for P-list/U-list ("Hazardous Discarded Commercial
 *   Chemical Products") entries. F-list ("Hazardous Wastes From
 *   Non-Specific Sources") entries, when present at all, carry an empty
 *   alternateIds array -- confirmed toluene (commonly F005 in practice)
 *   has no F-list entry in SRS at all. SRS cannot reliably supply F-codes
 *   (spent-solvent-mixture-based, not purely per-chemical) or
 *   D-characteristic codes (only a free-text reasonForRegulation hint
 *   like "Ignitability", never a mapped code). Callers MUST treat codes
 *   from this client as P/U-list-only and surface that F/K/D codes need
 *   manual verification.
 */

const SRS_BASE_URL = "https://cdxapps.epa.gov/oms-substance-registry-services/rest-api";

const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/;

interface SrsAlternateId {
  alternateId: string;
  alternateIdTypeName: string;
}

interface SrsSynonym {
  listName: string | null;
  reasonForRegulation: string | null;
  alternateIds: SrsAlternateId[] | null;
}

interface SrsSubstance {
  epaName: string;
  currentCasNumber: string | null;
  synonyms: SrsSynonym[] | null;
}

export interface ChemicalSearchMatch {
  name: string;
  casNumber: string | null;
  /** Confirmed RCRA P-list/U-list codes only -- see module doc. */
  codes: string[];
  /** True if an F-list or characteristic-hazard synonym entry was found
   * with no confirmed code attached -- callers should flag this so a
   * user doesn't mistake "no code returned" for "nothing applies". */
  hasUnconfirmedListing: boolean;
}

function extractMatch(substance: SrsSubstance): ChemicalSearchMatch {
  const codes = new Set<string>();
  let hasUnconfirmedListing = false;

  for (const syn of substance.synonyms ?? []) {
    const alternateIds = syn.alternateIds ?? [];
    for (const alt of alternateIds) {
      if (alt.alternateIdTypeName === "RCRA Hazardous Waste Code" && alt.alternateId) {
        codes.add(alt.alternateId);
      }
    }
    if (alternateIds.length === 0) {
      const flagged =
        syn.listName === "Hazardous Wastes From Non-Specific Sources" ||
        (syn.reasonForRegulation && /ignitab|corrosiv|reactiv|toxicit/i.test(syn.reasonForRegulation));
      if (flagged) hasUnconfirmedListing = true;
    }
  }

  return {
    name: substance.epaName,
    casNumber: substance.currentCasNumber,
    codes: Array.from(codes),
    hasUnconfirmedListing,
  };
}

/**
 * Searches SRS by CAS number (if the query looks like one, e.g.
 * "67-64-1") or by name otherwise. An empty array is a normal "not
 * found" result; this only throws on a genuine network/parse failure.
 */
export async function searchSrsSubstances(query: string): Promise<ChemicalSearchMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const from = CAS_PATTERN.test(trimmed) ? "cas" : "name";
  const url = `${SRS_BASE_URL}/substance/${from}/${encodeURIComponent(trimmed)}`;

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`EPA SRS lookup failed (HTTP ${response.status}).`);
  }

  const text = await response.text();
  if (!text || text.trim() === "[]") return [];

  const data = JSON.parse(text) as SrsSubstance[];
  return data.map(extractMatch);
}
