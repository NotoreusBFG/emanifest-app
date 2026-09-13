import ergTable from "../../../docs/erg-guide-numbers.json";

export interface ErgEntry {
  unNumber: string;
  guideNumber: string;
  materialName: string;
  note: string | null;
  tih: boolean;
}

export type ErgLookupConfidence = "confident" | "ambiguous" | "none";

export interface ErgLookupResult {
  guideNumber: string;
  confidence: ErgLookupConfidence;
  /** All candidate entries for this UN number, for callers that want to show alternatives. */
  candidates: ErgEntry[];
}

const entries = ergTable as ErgEntry[];

function normalizeUnNumber(idNumberCode: string): string {
  return idNumberCode.trim().toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^(UN|NA)/, "UN");
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2)
  );
}

/**
 * Looks up the ERG guide number for a profile's DOT ID number, sourced from
 * PHMSA's ERG2024 UN-index (via PubChem's bundled table, since PHMSA itself
 * only exposes a deep-link/sharing scheme, not a data API -- see
 * docs/erg-guide-numbers.json). A UN number maps to exactly one guide in
 * the vast majority of cases, but a handful (e.g. UN1057, UN3171) list
 * different guides for materially different products under the same
 * number -- properShippingName token overlap disambiguates those; when it
 * can't, the first candidate is returned as "ambiguous" so the caller shows
 * it as an editable, unconfirmed guess rather than blocking.
 */
export function lookupErgGuide(
  idNumberCode: string,
  properShippingName?: string
): ErgLookupResult {
  const un = normalizeUnNumber(idNumberCode);
  if (!un) return { guideNumber: "", confidence: "none", candidates: [] };

  const candidates = entries.filter((e) => e.unNumber === un);
  if (candidates.length === 0) return { guideNumber: "", confidence: "none", candidates: [] };

  const distinctGuides = new Set(candidates.map((c) => c.guideNumber));
  if (distinctGuides.size === 1) {
    return { guideNumber: candidates[0].guideNumber, confidence: "confident", candidates };
  }

  if (properShippingName) {
    const queryTokens = tokenize(properShippingName);
    let best: ErgEntry | null = null;
    let bestScore = 0;
    for (const c of candidates) {
      const candidateTokens = tokenize(c.materialName);
      let score = 0;
      for (const t of queryTokens) if (candidateTokens.has(t)) score++;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best && bestScore > 0) {
      return { guideNumber: best.guideNumber, confidence: "confident", candidates };
    }
  }

  return { guideNumber: candidates[0].guideNumber, confidence: "ambiguous", candidates };
}
