/**
 * Extensible table of real-world lab-pack category conventions, provided
 * incrementally by the client (South Lake Environmental) as industry
 * packing-protocol knowledge, distinct from the CFR-derived compliance
 * screens in complianceCheck.ts. Each entry is a named category a
 * non-RCRA (or, for hardSegregate categories, ANY) item can belong to,
 * with a join rule the segregation step (packingRules.ts's
 * groupIntoDrums) applies when deciding whether an item can share an
 * existing drum or must start/join a category-specific one.
 *
 * Canonical source: docs/pack-categories.json (kept in sync by hand --
 * this file is the typed TS consumer, that JSON is the portable copy
 * shared with the lab-pack-segregation Claude Code skill). Add new rows
 * as the client shares more categories -- do not invent categories not
 * explicitly given.
 */

export type PackCategoryKey =
  | "oxidizer_alone"
  | "peroxide_by_un"
  | "toxic_organic_pg2_3"
  | "inorganic_acid"
  | "inorganic_base"
  | "salts_flexible"
  | "non_haz_general";

export interface PackCategory {
  key: PackCategoryKey;
  label: string;
  /** true = this category is a hard segregation rule (never pools with
   * anything else, no exceptions) rather than a soft "prefer to join if
   * present" rule. */
  hardSegregate: boolean;
  rule: string;
  joinCondition: string;
  example?: string;
}

export const PACK_CATEGORIES: PackCategory[] = [
  {
    key: "oxidizer_alone",
    label: "Class 5.1 oxidizers",
    hardSegregate: true,
    rule: "A DOT Class 5.1 (oxidizer) item is NEVER combined with any other material in any drum, regardless of RCRA status or general Appendix V compatibility. Contamination risk with organic material. Always its own drum, always.",
    joinCondition: "none — hard rule, no exceptions",
  },
  {
    key: "peroxide_by_un",
    label: "Class 5.2 organic peroxides",
    hardSegregate: true,
    rule: "A DOT Class 5.2 (organic peroxide) item is always segregated by its own DOT UN number specifically — two different UN numbers within 5.2 do not share a drum even with each other, let alone anything else.",
    joinCondition: "only an item sharing the exact same UN number, never combined across different UN numbers or with any other class",
  },
  {
    key: "toxic_organic_pg2_3",
    label: "Toxic (6.1) organic liquids, PG II/III",
    hardSegregate: false,
    rule: "Non-RCRA organic materials generally join a toxic (Division 6.1) PG II or PG III organic lab pack when one exists in the job.",
    joinCondition: "item is organic, non-RCRA (or RCRA-compatible per the normal Appendix V screen), and the job has an existing 6.1 PG II/III organic drum with room",
    example: "Methyl salicylate (2026-09-25 inventory) — non-RCRA organic ester; would join a toxic PG II/III organic drum if one existed in that job. None did, so it got its own drum by default, not because it's inherently un-poolable.",
  },
  {
    key: "inorganic_acid",
    label: "Inorganic acids",
    hardSegregate: false,
    rule: "Non-regulated inorganic materials generally join an inorganic-acid-compatible lab pack.",
    joinCondition: "item is inorganic and acid-compatible, and the job has an existing inorganic-acids drum with room",
    example: "Iodine crystals (2026-09-25 inventory) — inorganic, acid-compatible; would join an inorganic-acids drum if one existed in that job. None did, so it got its own drum by default.",
  },
  {
    key: "inorganic_base",
    label: "Inorganic bases / caustics",
    hardSegregate: false,
    rule: "Non-regulated inorganic materials generally join an acid/base-compatible lab pack (base side of the same general category as inorganic_acid — do not combine the acid and base sub-groups with each other, same as the existing Appendix V 1-A/1-B pairing).",
    joinCondition: "item is inorganic and base-compatible, and the job has an existing inorganic-base drum with room",
  },
  {
    key: "salts_flexible",
    label: "Common salts",
    hardSegregate: false,
    rule: "Common salts are flexible — generally placed in a toxic, acid, or non-haz lab pack depending on the specific salt's own hazard profile. Not a single fixed category; evaluate the specific salt against the other categories first (toxic_organic_pg2_3, inorganic_acid, inorganic_base, non_haz_general) and place accordingly.",
    joinCondition: "case-by-case per the salt's actual hazard characteristics; this row exists to flag salts as poolable rather than defaulting them to their own isolated drum",
  },
  {
    key: "non_haz_general",
    label: "Non-hazardous, general",
    hardSegregate: false,
    rule: "The fallback category: a non-RCRA item with no better-matching category above (no compatible inorganic-acid/base drum, no toxic-organic drum, not a salt with a clearer home) goes into a general non-haz lab pack alongside any other item that also has no better category match, subject to the normal compatible-and-room test.",
    joinCondition: "item is non-RCRA, no more specific category above applies, and the job has an existing non-haz-general drum with room",
  },
];

export function getPackCategory(key: PackCategoryKey): PackCategory {
  const found = PACK_CATEGORIES.find((c) => c.key === key);
  if (!found) throw new Error(`Unknown pack category key: ${key}`);
  return found;
}

/**
 * Best-effort classification of which non-RCRA category an item prefers,
 * from its chemical name + DOT hazard class. Name-keyword heuristic only
 * (mirrors complianceCheck.ts's own classifyCompatibilityGroups posture) --
 * exists to suggest a starting category for a human to confirm, not to be
 * authoritative chemistry. Returns null if nothing matches (falls through
 * to non_haz_general as the caller's own default).
 */
export function suggestPackCategory(params: {
  chemicalName: string;
  hazardClass?: string;
  physicalState?: string | null;
}): PackCategoryKey | null {
  const name = params.chemicalName.toLowerCase();
  const hazardClass = (params.hazardClass ?? "").trim();

  if (hazardClass.startsWith("5.1")) return "oxidizer_alone";
  if (hazardClass.startsWith("5.2")) return "peroxide_by_un";

  // Common salt keyword check first -- salts_flexible is explicitly
  // "evaluate against the others first", so a salt name alone doesn't
  // short-circuit to salts_flexible; it's a hint for a human reviewing
  // the suggestion, surfaced via the caller checking isLikelySalt
  // separately rather than returned here.

  const isInorganic = /iodine|iodide|chlorate|chlorite|hypochlorite|sulfate|sulfite|nitrate|nitrite|phosphate|carbonate|bicarbonate|chromate|permanganate|cyanide|hydroxide|oxide\b|chloride(?!\s*form)|bromide|fluoride|metal|mercury|lead|cadmium|arsenic|selenium|barium|silver|zinc|copper(?!\s*sulfate\s*pentahydrate\s*organic)/i.test(
    name
  );
  const isAcidCompatible = isInorganic && /iodine|sulfate|sulfite|nitrate|nitrite|phosphate|chromate|chloride|bromide|fluoride/i.test(name);
  const isBaseCompatible = isInorganic && /hydroxide|carbonate|bicarbonate|oxide\b/i.test(name);

  if (isBaseCompatible) return "inorganic_base";
  if (isAcidCompatible || isInorganic) return "inorganic_acid";

  // Organic (contains carbon-typical solvent/ester/alcohol/ketone naming)
  // and non-RCRA -> prefer a toxic organic PG II/III home if this item is
  // itself Division 6.1, otherwise fall through to non_haz_general (an
  // organic item that ISN'T even 6.1 toxic has no stronger category match
  // here yet).
  if (hazardClass.startsWith("6.1")) return "toxic_organic_pg2_3";

  return null;
}

export function isLikelySalt(chemicalName: string): boolean {
  return /\b(chloride|sulfate|sulfite|nitrate|nitrite|phosphate|carbonate|bicarbonate|acetate|bromide|fluoride|iodide)\b/i.test(
    chemicalName
  );
}
