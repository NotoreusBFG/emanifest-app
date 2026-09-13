/**
 * Dependency-free client for PubChem's PUG-REST/PUG-View APIs (NLM/NCBI,
 * not EPA itself, but the RCRA data it carries is sourced from EPA's own
 * regulations via the old Hazardous Substances Data Bank). Public, no API
 * key. Added 2026-09-13 as a second search tier alongside EPA's SRS (see
 * srsClient.ts) after live-testing showed it fills SRS's biggest gap.
 *
 * Two-step lookup, both confirmed live:
 *   1. GET https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{query}/cids/JSON
 *      `{query}` can be a chemical name OR a CAS number (confirmed:
 *      "108-88-3" resolves to CID 1140, toluene) -- returns a CID.
 *   2. GET https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON/?heading=RCRA+Requirements
 *      Returns a "RCRA Requirements" section (path: Safety and Hazards >
 *      Regulatory Information > RCRA Requirements) with one Information
 *      entry per applicable code, each a citation-backed plain-English
 *      string, e.g. "F005; When toluene is a spent solvent, it is
 *      classified as a hazardous waste from a nonspecific source (F005),
 *      as stated in 40 CFR 261.31...".
 *
 * Why this is worth a second tier, not just SRS: confirmed live for
 * toluene, PubChem returns BOTH F005 and U220 with citations -- SRS's own
 * database has no F-list entry for toluene at all (see
 * reference_epa_srs_chemical_api memory / srsClient.ts). PubChem's data
 * is HSDB-sourced, and HSDB explicitly curated the F/K/D-list "when used
 * as a spent solvent" conditions SRS's straight list-membership model
 * can't represent.
 *
 * Coverage caveat, also confirmed live: trimethylarsine (CAS 593-88-4,
 * not RCRA-listed at all) has NO "RCRA Requirements" section whatsoever
 * in its PubChem record -- HSDB only ever curated a few thousand
 * well-known industrial/environmental chemicals, not the full CAS
 * universe. A miss here means "not curated", not "definitely no code".
 */

const PUG_REST_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const PUG_VIEW_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view";

export interface PubchemRcraResult {
  /** The exact codes found (e.g. ["F005", "U220"]), parsed from the
   * leading "CODE; explanation" pattern each Information string uses. */
  codes: string[];
  /** The full citation-backed explanation string(s) PubChem returned,
   * one per code -- shown to the user as evidence, not just the bare
   * code, since these often state a condition (e.g. "when a spent
   * solvent") that matters for whether the code actually applies. */
  explanations: string[];
}

/** D001 (ignitability, 40 CFR 261.21(a)(1)) and D002 (corrosivity, 40
 * CFR 261.22(a)(1)) thresholds -- the two RCRA characteristics that are
 * pure numeric-property tests, so (unlike D003's qualitative reactivity
 * criteria, or D001's oxidizer clause) they're the only ones a parsed
 * literature value can actually evaluate. */
const D001_FLASH_POINT_THRESHOLD_C = 60; // 140 F
const D002_PH_LOW_THRESHOLD = 2;
const D002_PH_HIGH_THRESHOLD = 12.5;

/** Pulls every "<number> °F" or "<number> °C" reading out of a PubChem
 * Flash Point section's free-text values (e.g. "104 °F (NTP, 1992)") and
 * returns them all normalized to Celsius. Multiple citations commonly
 * disagree slightly -- callers should use the minimum (most conservative
 * for the "capable of being ignitable" test) rather than picking one
 * arbitrarily. */
function parseFlashPointsCelsius(rawStrings: string[]): number[] {
  const values: number[] = [];
  for (const raw of rawStrings) {
    for (const m of raw.matchAll(/(-?\d+(?:\.\d+)?)\s*°?\s*([FC])\b/g)) {
      const num = parseFloat(m[1]);
      values.push(m[2] === "F" ? ((num - 32) * 5) / 9 : num);
    }
  }
  return values;
}

/** Pulls pH readings out of a PubChem pH section's free-text value.
 * PubChem's real format is usually "<concentration> molar = <pH>;
 * <concentration> molar = <pH>; ..." (confirmed live for acetic acid) --
 * so numbers after "=" are the actual pH values, NOT the molarity
 * numbers before it (a plain "extract every number" parse would
 * misread molarity as pH, e.g. treating "10.0 molar" as a pH of 10).
 * Falls back to any bare 0-14 number only if no "=" pattern is found,
 * for the less common single-value format -- lower confidence, but
 * better than nothing. */
function parsePhValues(rawStrings: string[]): number[] {
  const values: number[] = [];
  for (const raw of rawStrings) {
    // Tier 1: "<concentration> = <pH>" (e.g. "1.0 molar = 2.4") -- the
    // number after "=" is the actual pH, never the concentration before it.
    const equalsMatches = [...raw.matchAll(/=\s*(-?\d+(?:\.\d+)?)/g)];
    if (equalsMatches.length > 0) {
      for (const m of equalsMatches) values.push(parseFloat(m[1]));
      continue;
    }
    // Tier 2: "<concentration>% ... about/approximately <pH>" (e.g. "pH
    // of a 0.05% wt/wt solution about 12") -- PubChem's other common
    // phrasing. Confirmed live for sodium hydroxide: naively grabbing
    // every bare number here would misread the leading "0.05%"
    // concentration as if it were the pH itself.
    const aboutMatches = [...raw.matchAll(/\b(?:about|approximately)\s+(-?\d+(?:\.\d+)?)/gi)];
    if (aboutMatches.length > 0) {
      for (const m of aboutMatches) values.push(parseFloat(m[1]));
      continue;
    }
    // Tier 3 (last resort, no "=" or "about/approximately" anchor found):
    // any bare 0-14 number, but explicitly excluding ones immediately
    // followed by "%" or a concentration-unit word -- still a heuristic,
    // not as trustworthy as tiers 1/2, but better than nothing for a
    // plain "pH: 3" style value with no anchor word at all.
    for (const m of raw.matchAll(/\b(\d+(?:\.\d+)?)\b(?!\s*(?:%|molar|M\b|N\b|wt))/g)) {
      const num = parseFloat(m[1]);
      if (num >= 0 && num <= 14) values.push(num);
    }
  }
  return values;
}

/** Evaluates PubChem's raw Flash Point / pH literature values against
 * the actual RCRA D001/D002 numeric thresholds and returns any code(s)
 * that apply, each with a citation-style explanation showing the exact
 * value and threshold used -- so an auto-filled code stays auditable
 * even though it's asserted, not just flagged. Conservative by design:
 * uses the single most-extreme parsed value (lowest flash point,
 * lowest-or-highest pH) so a genuinely below-threshold literature
 * report is never diluted by an ambiguous or off-target companion value.
 * This is about the PURE/typical commercial form of the compound --
 * still doesn't know the caller's actual waste's real concentration or
 * physical form, which is why the explanation text always says so. */
export function evaluateIgnitabilityAndCorrosivity(
  flashPointStrings: string[],
  phStrings: string[]
): { codes: string[]; explanations: string[] } {
  const codes: string[] = [];
  const explanations: string[] = [];

  const flashPointsC = parseFlashPointsCelsius(flashPointStrings);
  if (flashPointsC.length > 0) {
    const lowestC = Math.min(...flashPointsC);
    if (lowestC < D001_FLASH_POINT_THRESHOLD_C) {
      codes.push("D001");
      explanations.push(
        `D001; PubChem-reported flash point ${lowestC.toFixed(1)}°C (${(lowestC * 9) / 5 + 32}°F) is below the 60°C/140°F threshold in 40 CFR 261.21(a)(1) -- auto-detected from literature data for the pure/typical commercial compound, not your specific waste's actual measured flash point or physical form.`
      );
    }
  }

  const phValues = parsePhValues(phStrings);
  if (phValues.length > 0) {
    const lowest = Math.min(...phValues);
    const highest = Math.max(...phValues);
    if (lowest <= D002_PH_LOW_THRESHOLD || highest >= D002_PH_HIGH_THRESHOLD) {
      const triggerValue = lowest <= D002_PH_LOW_THRESHOLD ? lowest : highest;
      codes.push("D002");
      explanations.push(
        `D002; PubChem-reported pH ${triggerValue} meets the <=2 or >=12.5 threshold in 40 CFR 261.22(a)(1) -- auto-detected from literature data (often a specific concentration's aqueous solution, not necessarily your actual waste's measured pH).`
      );
    }
  }

  return { codes, explanations };
}

function extractSectionStrings(node: PubchemViewSection | null): string[] {
  if (!node) return [];
  const strings: string[] = [];
  for (const info of node.Information ?? []) {
    for (const s of info.Value?.StringWithMarkup ?? []) {
      if (s.String) strings.push(s.String);
    }
  }
  return strings;
}

/** Fetches PubChem's literature Flash Point and pH values for a compound
 * (already-resolved CID) and evaluates them against the RCRA D001/D002
 * thresholds. Returns empty codes/explanations if PubChem has neither
 * property curated for this compound -- a normal "not available"
 * outcome, not an error, same posture as searchPubchemRcraRequirements. */
export async function getPubchemCharacteristicCodes(cid: number): Promise<PubchemRcraResult> {
  const [flashPointSection, phSection] = await Promise.all([
    fetchViewSection(cid, "Flash Point"),
    fetchViewSection(cid, "pH"),
  ]);
  return evaluateIgnitabilityAndCorrosivity(extractSectionStrings(flashPointSection), extractSectionStrings(phSection));
}

/** Looks up a chemical by name or CAS number and evaluates its PubChem
 * literature Flash Point/pH data against the D001/D002 thresholds (see
 * getPubchemCharacteristicCodes). Returns empty codes/explanations if
 * the compound isn't found or PubChem has neither property curated for
 * it -- a normal "can't evaluate" outcome, not an error. */
export async function searchPubchemCharacteristicCodes(query: string): Promise<PubchemRcraResult> {
  const cid = await resolveCid(query.trim());
  if (cid === null) return { codes: [], explanations: [] };
  return getPubchemCharacteristicCodes(cid);
}

async function resolveCid(query: string): Promise<number | null> {
  const url = `${PUG_REST_BASE}/compound/name/${encodeURIComponent(query)}/cids/JSON`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`PubChem CID lookup failed (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as { IdentifierList?: { CID?: number[] } };
  return data.IdentifierList?.CID?.[0] ?? null;
}

interface PubchemViewSection {
  TOCHeading?: string;
  Section?: PubchemViewSection[];
  Information?: Array<{
    Value?: { StringWithMarkup?: Array<{ String?: string }> };
  }>;
}

function findSection(node: PubchemViewSection, heading: string): PubchemViewSection | null {
  if (node.TOCHeading === heading) return node;
  for (const child of node.Section ?? []) {
    const found = findSection(child, heading);
    if (found) return found;
  }
  return null;
}

/** Shared PUG-View fetch-by-heading -- used for "RCRA Requirements"
 * (identity-based codes) and "Flash Point"/"pH" (property-based
 * evaluation) alike. Returns null for "this compound has no such
 * section", the normal case for most headings on most compounds, not
 * an error. */
async function fetchViewSection(cid: number, heading: string): Promise<PubchemViewSection | null> {
  const url = `${PUG_VIEW_BASE}/data/compound/${cid}/JSON/?heading=${encodeURIComponent(heading)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (response.status === 400 || response.status === 404) {
    // "Heading not found" -- this compound has no section for this heading.
    return null;
  }
  if (!response.ok) {
    throw new Error(`PubChem lookup failed (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as { Record?: PubchemViewSection };
  return data.Record ? findSection(data.Record, heading) : null;
}

const CODE_PATTERN = /^([DFKPU]\d{3});\s*(.+)$/;

/** Looks up a chemical by name or CAS number and returns any RCRA codes
 * PubChem's HSDB-sourced "RCRA Requirements" section has for it. Returns
 * null codes/explanations (empty arrays) if the compound isn't found or
 * has no such section -- a normal "not curated" outcome, not an error. */
export async function searchPubchemRcraRequirements(query: string): Promise<PubchemRcraResult> {
  const cid = await resolveCid(query.trim());
  if (cid === null) return { codes: [], explanations: [] };

  const section = await fetchViewSection(cid, "RCRA Requirements");
  if (!section) return { codes: [], explanations: [] };

  const codes = new Set<string>();
  const explanations: string[] = [];
  for (const info of section.Information ?? []) {
    for (const s of info.Value?.StringWithMarkup ?? []) {
      const text = s.String ?? "";
      const match = text.match(CODE_PATTERN);
      if (match) {
        codes.add(match[1]);
        explanations.push(text);
      }
    }
  }
  return { codes: Array.from(codes), explanations };
}
