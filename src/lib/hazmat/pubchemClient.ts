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

const CODE_PATTERN = /^([DFKPU]\d{3});\s*(.+)$/;

/** Looks up a chemical by name or CAS number and returns any RCRA codes
 * PubChem's HSDB-sourced "RCRA Requirements" section has for it. Returns
 * null codes/explanations (empty arrays) if the compound isn't found or
 * has no such section -- a normal "not curated" outcome, not an error. */
export async function searchPubchemRcraRequirements(query: string): Promise<PubchemRcraResult> {
  const cid = await resolveCid(query.trim());
  if (cid === null) return { codes: [], explanations: [] };

  const url = `${PUG_VIEW_BASE}/data/compound/${cid}/JSON/?heading=RCRA+Requirements`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (response.status === 400 || response.status === 404) {
    // "Heading not found" -- this compound has no RCRA Requirements section.
    return { codes: [], explanations: [] };
  }
  if (!response.ok) {
    throw new Error(`PubChem RCRA lookup failed (HTTP ${response.status}).`);
  }

  const data = (await response.json()) as { Record?: PubchemViewSection };
  const section = data.Record ? findSection(data.Record, "RCRA Requirements") : null;
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
