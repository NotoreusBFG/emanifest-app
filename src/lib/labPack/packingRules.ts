/**
 * Shared packing-slip rules ported from the lab-pack-segregation Claude
 * Code skill's `scripts/packing_rules.py` (2026-09-26 revision), so the
 * in-app Segregation Wizard and the standalone skill can't drift apart on
 * shipping-name format, drum sizing, or weight estimation.
 *
 * Client-directive rules encoded here:
 *  - Shipping name: UN number first, "Waste" (not "Hazardous"), NOS +
 *    contents in parens, PG at end. If no RCRA waste code is assigned for
 *    the drum, the word "Waste" is omitted entirely.
 *  - Outer container type: 5/15/30 gal = DF (fiber); 55 gal = DM (steel)
 *    except acid lab packs, which go in DF 55-gal drums.
 *  - Weights: empty-drum tare (5g=5 lb, 15g=10, 30g=12, 55g=20) + item full
 *    weights, capped at 5g=30 / 15g=50 / 30g=150 / 55g=250 lb. 1-gallon
 *    bottles are estimated HALF FULL; pint/quart/metric containers count
 *    full (a stated metric total, e.g. "27 L", is an exact given quantity,
 *    not a container-fill guess).
 *  - EPA waste code scope: only F001-F005 + dioxin codes are assigned;
 *    later F-codes (e.g. F019) are out-of-scope. Solids are NOT D002
 *    (40 CFR 261.22 is aqueous/liquid only).
 *  - Waste-code default (2026-09-26 client directive): assume every item is
 *    spent/used material by default. F-codes (F002-F005 scope, never F001
 *    by default) are the primary code whenever a chemical has an F-list
 *    match. A U-code applies instead only when the item is the sole active
 *    ingredient / commercially pure grade (40 CFR 261.33's actual U-list
 *    eligibility test), or its own description explicitly says
 *    virgin/new/unused -- mirrored here as the `isUnusedMaterial` flag,
 *    matching the existing manual-entry form's own
 *    ChemicalNameSearchField "Unused / virgin material" checkbox
 *    convention (src/components/ChemicalNameSearchField.tsx).
 *  - Non-RCRA segregation (2026-09-26 client directive): a non-RCRA item
 *    may only share a drum with hazardous-waste items when compatible AND
 *    there's room; otherwise it joins/starts a category drum per
 *    packCategories.ts. A non-RCRA item that's also not DOT-regulated at
 *    all gets the fixed literal shipping description NON_DOT_NON_RCRA_NAME.
 */

import type { PhysicalState } from "./types";
import { classifyCompatibilityGroups, checkLabPackCompliance, type LabPackComplianceWarning } from "./complianceCheck";
import { PACK_CATEGORIES, suggestPackCategory, type PackCategoryKey } from "./packCategories";

export function cleanDot(raw: string | null | undefined): string {
  const first = (raw ?? "").split(" [", 1)[0].trim();
  return first || "—";
}

export function sizeGal(raw: string | null | undefined): string {
  const parts = (raw ?? "").replace(" gal", "gal").split(/\s+/).filter((p) => p.includes("-gal"));
  return parts[0] ? parts[0].replace("-gal", "") : "5";
}

const ACID_HINTS = ["acid", "hydrochloric", "sulfuric", "phosphoric", "nitric", "chromic", "acetic", "hydrofluoric", "hydrobromic"];

export function acidPack(text: string | null | undefined): boolean {
  const lower = (text ?? "").toLowerCase();
  return ACID_HINTS.some((h) => lower.includes(h));
}

export function outerType(sizeStr: string, desc = ""): "DF" | "DM" {
  const gal = parseInt(sizeGal(sizeStr), 10) || 5;
  if (gal <= 30) return "DF";
  return acidPack(desc) ? "DF" : "DM";
}

const TARE_LB: Record<number, number> = { 5: 5, 15: 10, 30: 12, 55: 20 };
const MAX_LB: Record<number, number> = { 5: 30, 15: 50, 30: 150, 55: 250 };

const DENSITY_HINTS: [string, number][] = [
  ["sulfuric", 1.84], ["nitric", 1.51], ["phosphoric", 1.71],
  ["hydrochloric", 1.19], ["hydrofluoric", 1.15], ["hydrobromic", 1.49],
  ["chromic", 1.33], ["acetic", 1.05], ["formic", 1.22],
  ["sodium hydroxide", 2.13], ["potassium hydroxide", 2.04],
  ["trimethylamine", 0.9], ["triethylamine", 0.73],
  ["acetone", 0.79], ["methanol", 0.79], ["ethanol", 0.79],
  ["methyl ethyl ketone", 0.805], ["toluene", 0.867], ["xylene", 0.86],
  ["isopropanol", 0.79], ["isopropyl", 0.79], ["isocyanate", 0.95],
  ["polyamine", 0.95],
  ["methylene chloride", 1.33], ["dichloromethane", 1.33],
  ["heptane", 0.68], ["hexane", 0.66], ["petroleum ether", 0.65],
  ["cyclohexanone", 0.95], ["ethyl acetate", 0.90], ["cyclohexene", 0.81],
  ["acetonitrile", 0.786],
];

const VOL_GAL: Record<string, number> = {
  pint: 1 / 8, pt: 1 / 8, quart: 1 / 4, qt: 1 / 4, gal: 1.0, gallon: 1.0,
  l: 0.264172, liter: 0.264172, litre: 0.264172,
  ml: 0.264172 / 1000, milliliter: 0.264172 / 1000,
};
// Only "gal"/"gallon" get the "estimated half full" discount (a 1-gallon
// bottle in a lab inventory is often partially used) -- a stated metric
// total (27 L, 500 mL) is an exact given quantity, not a container-fill
// guess, so it's taken at face value like pint/quart.
const FILL_FRACTION: Record<string, number> = {
  gal: 0.5, gallon: 0.5, pint: 1.0, pt: 1.0, quart: 1.0, qt: 1.0,
  l: 1.0, liter: 1.0, litre: 1.0, ml: 1.0, milliliter: 1.0,
};

const VOLUME_RE = /(\d+(?:\.\d+)?)\s*(gal|gallon|pint|pt|quart|qt|ml|milliliter|l|liter|litre)\b/i;

export function volumeGal(sizeStr: string | null | undefined): number {
  const s = (sizeStr ?? "").toLowerCase();
  const m = VOLUME_RE.exec(s);
  if (!m) return 0;
  const unit = m[2].toLowerCase();
  return parseFloat(m[1]) * (VOL_GAL[unit] ?? 0) * (FILL_FRACTION[unit] ?? 1);
}

export function sgFor(chemical: string | null | undefined): number | null {
  const c = (chemical ?? "").toLowerCase();
  for (const [hint, sg] of DENSITY_HINTS) {
    if (c.includes(hint)) return sg;
  }
  return null;
}

export function itemFullLb(chemical: string, sizeStr: string, phase = ""): number {
  const gal = volumeGal(sizeStr);
  if (gal <= 0) return 0;
  const sg = sgFor(chemical) ?? (phase === "solid" ? 2.0 : 1.0);
  return gal * 8.34 * sg;
}

export function drumWeightLb(sizeStr: string, itemSizes: [string, string, string][]): number {
  const gal = parseInt(sizeGal(sizeStr), 10) || 5;
  const est = (TARE_LB[gal] ?? 20) + itemSizes.reduce((sum, [chem, size, phase]) => sum + itemFullLb(chem, size, phase), 0);
  return Math.min(est, MAX_LB[gal] ?? 250);
}

// [\s\S]* instead of a dotAll ".*" -- same "match across newlines" effect
// without requiring the "s" flag (which needs an es2018+ TS target).
const CODE_RE = /^\s*([A-Z]\d{3})\s*(?:\(([\s\S]*)\))?\s*$/;

export function codeParts(code: string | null | undefined): { code: string; note: string } | null {
  const m = CODE_RE.exec(code ?? "");
  if (!m) return null;
  return { code: m[1], note: (m[2] ?? "").trim() };
}

/** Fixed literal shipping description for a drum that is BOTH non-RCRA (no
 * assigned waste code) AND not DOT-hazmat-regulated at all -- client
 * directive, verbatim, never run through the UN-first/PG parser below
 * (which would otherwise prepend a bogus "UN--" since there's no real UN#
 * to match). Fields, left to right: shipping name, UN#, hazard class,
 * packing group. */
export const NON_DOT_NON_RCRA_NAME = "Non DOT, Non RCRA Regulated Materials,none,n/a,n/a";

export function isNonDotNonRcra(raw: string | null | undefined): boolean {
  return cleanDot(raw).trim().toLowerCase().startsWith("non dot, non rcra regulated materials");
}

export function shippingName(raw: string | null | undefined, rq = false, waste = true): string {
  if (isNonDotNonRcra(raw)) return NON_DOT_NON_RCRA_NAME;

  let text = cleanDot(raw);
  text = text.replace(/\s*\(verify[^)]*\)/gi, "").trim();
  text = text.replace(/\s*\(per[^)]*\)/gi, "").trim();
  const un = /UN(\d{4})/.exec(text);
  const pg = /PG\s*(I{1,3})/.exec(text);
  const contentsMatch = /\(\s*Hazardous Waste --\s*([^)]*)\)/i.exec(text) ?? /\(([^)]*)\)/.exec(text);
  let contents = (contentsMatch?.[1] ?? "").trim();
  contents = contents.split(/\s+/).join(" ");
  contents = contents
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(", ");

  let core = text.split(" (", 1)[0].trim();
  core = core.replace(/,\s*n\.o\.s\.?/gi, "").trim();
  core = core.replace(/^Hazardous\s+Waste\s*,\s*(corrosive)?\s*,?\s*/gi, "").trim();
  core = core.replace(/^Hazardous\s+waste\s*,\s*(corrosive)?\s*,?\s*/gi, "").trim();
  core = core.replace(/^waste\s*,\s*/gi, "").trim();
  core = core.replace(/\bliquid(s)?\b/gi, "Liquids");
  core = core.replace(/\bsolid(s)?\b/gi, "Solids");
  core = core.split(/\s+/).join(" ");
  if (core) {
    core = core
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
    core = core.replace(/\bNos\b/g, "NOS");
  }
  let name = `Waste ${core}`.trim() || "Waste";
  if (!waste) name = core || "Waste";

  let out = un ? `UN${un[1]}` : "UN—";
  if (rq) out += ", RQ";
  out += contents ? `, ${name}, NOS (${contents})` : `, ${name}, NOS`;
  if (pg) out += `, PG${pg[1]}`;
  return out;
}

// ---------------------------------------------------------------------------
// groupIntoDrums -- the ported Step 4 (segregate into drum groups)
// ---------------------------------------------------------------------------

export interface CharacterizedWizardItem {
  /** Client-side temp id for this draft session -- not a DB id. */
  id: string;
  chemicalName: string;
  quantity: number | null;
  containerSize: string;
  physicalState: PhysicalState | null;
  epaWasteCodes: string[];
  sourceLocation: string;
  notes: string;
  /** DOT hazard class/division if known, e.g. "5.1", "6.1", "3". Drives
   * hard-segregation (5.1/5.2) and non-RCRA category suggestions. */
  hazardClass?: string;
  unNumber?: string;
  /** True if the item is DOT-hazmat-regulated at all (has a real UN#/
   * hazard class) -- distinguishes the two non-RCRA shipping-description
   * sub-cases (real DOT description vs the fixed NON_DOT_NON_RCRA_NAME
   * string). Defaults to true when hazardClass/unNumber is set. */
  isDotRegulated?: boolean;
}

export interface DrumGroup {
  drumNumber: number;
  /** Loose classification for the review screen's card label -- not a
   * drumLabel (that's assigned on save, per labPackRepository's
   * getNextDrumNumber). */
  category: PackCategoryKey | "hazardous" | "hard_segregated";
  items: CharacterizedWizardItem[];
  isNonHazardous: boolean;
  wasteCodes: string[];
  warnings: LabPackComplianceWarning[];
  /** Volume sum (gallons) across all items in this drum, for the
   * suggested-outer-drum-size heuristic downstream. */
  volumeGal: number;
}

/** Advisory-only volume cap per drum before starting a new one within the
 * same category -- NOT a regulatory limit, just a practical "don't try to
 * cram an unreasonable amount of liquid into one drum" heuristic the
 * packer should confirm at pack time (matches the skill's own W15-style
 * "verify drum capacity" flag from the 2026-09-25 real run). */
const DEFAULT_DRUM_VOLUME_CAP_GAL = 20;

function aggregateCodes(items: CharacterizedWizardItem[]): string[] {
  const codes = new Set<string>();
  for (const item of items) {
    for (const raw of item.epaWasteCodes) {
      const parsed = codeParts(raw);
      if (parsed) codes.add(parsed.code);
    }
  }
  return Array.from(codes);
}

function hasRcraCode(item: CharacterizedWizardItem): boolean {
  return item.epaWasteCodes.some((c) => codeParts(c) !== null);
}

/** True if `candidate` is chemically compatible with every item already in
 * `existing`, per complianceCheck.ts's Appendix V A/B group classifier --
 * reused, not reimplemented, so this can never drift from the same check
 * the manual lab-pack form already runs. */
function isCompatibleWithDrum(candidate: CharacterizedWizardItem, existing: CharacterizedWizardItem[]): boolean {
  const candidateGroups = classifyCompatibilityGroups(candidate.chemicalName);
  const PAIRS: [string, string][] = [
    ["1-A", "1-B"], ["2-A", "2-B"], ["3-A", "3-B"], ["4-A", "4-B"], ["5-A", "5-B"], ["6-A", "6-B"],
  ];
  for (const existingItem of existing) {
    const existingGroups = classifyCompatibilityGroups(existingItem.chemicalName);
    for (const [a, b] of PAIRS) {
      const candHasA = candidateGroups.includes(a as never);
      const candHasB = candidateGroups.includes(b as never);
      const exHasA = existingGroups.includes(a as never);
      const exHasB = existingGroups.includes(b as never);
      if ((candHasA && exHasB) || (candHasB && exHasA)) return false;
    }
  }
  return true;
}

function volumeSum(items: CharacterizedWizardItem[]): number {
  return items.reduce((sum, item) => sum + volumeGal(item.containerSize), 0);
}

/**
 * Segregate a characterized inventory into drum groups per the client's
 * 2026-09-26 packing-protocol directives:
 *  1. Hard-segregate first: 5.1 oxidizers each get their own singleton
 *     drum; 5.2 organic peroxides are grouped strictly by UN number.
 *  2. Everything else: items WITH an RCRA waste code are hazardous-waste
 *     drums, packed together when compatible (Appendix V) and there's
 *     volume headroom, split into a new drum otherwise.
 *  3. Items with NO RCRA code (non-RCRA) prefer a matching
 *     packCategories.ts category drum (inorganic acid/base, toxic-organic
 *     PG II/III, salts, or the non_haz_general fallback) over joining a
 *     hazardous drum -- they may only join an existing hazardous drum
 *     when compatible AND there's room; otherwise they start/join their
 *     own category drum.
 *
 * This is advisory grouping for the wizard's review screen, matching the
 * skill's own "warn, don't block" posture -- the human can still merge/
 * split drums on that screen before saving (see the "Combine with…"
 * consolidate action), this just proposes a sane starting point.
 */
export function groupIntoDrums(items: CharacterizedWizardItem[]): DrumGroup[] {
  const drums: DrumGroup[] = [];
  let nextDrumNumber = 1;

  const newDrum = (category: DrumGroup["category"]): DrumGroup => {
    const drum: DrumGroup = {
      drumNumber: nextDrumNumber++,
      category,
      items: [],
      isNonHazardous: false,
      wasteCodes: [],
      warnings: [],
      volumeGal: 0,
    };
    drums.push(drum);
    return drum;
  };

  const finalizeDrum = (drum: DrumGroup) => {
    drum.wasteCodes = aggregateCodes(drum.items);
    drum.isNonHazardous = drum.wasteCodes.length === 0;
    drum.volumeGal = volumeSum(drum.items);
    drum.warnings = checkLabPackCompliance({
      wasteCodes: drum.wasteCodes,
      dotShippingDescription: drum.items[0]?.chemicalName ?? "",
      isNonHazardous: drum.isNonHazardous,
      lineItems: drum.items.map((i) => ({ chemicalName: i.chemicalName })),
    });
  };

  // --- Step 1: hard segregation (5.1 alone, 5.2 by UN#) ---
  const remaining: CharacterizedWizardItem[] = [];
  const peroxideByUn = new Map<string, CharacterizedWizardItem[]>();
  for (const item of items) {
    const cls = (item.hazardClass ?? "").trim();
    if (cls.startsWith("5.1")) {
      const drum = newDrum("hard_segregated");
      drum.items.push(item);
      continue;
    }
    if (cls.startsWith("5.2")) {
      const key = item.unNumber?.trim() || "UNKNOWN";
      const bucket = peroxideByUn.get(key) ?? [];
      bucket.push(item);
      peroxideByUn.set(key, bucket);
      continue;
    }
    remaining.push(item);
  }
  for (const bucket of peroxideByUn.values()) {
    const drum = newDrum("hard_segregated");
    drum.items.push(...bucket);
  }

  // --- Step 2/3: hazardous vs non-RCRA, category-aware pooling ---
  const hazardousDrums: DrumGroup[] = [];
  const categoryDrums = new Map<PackCategoryKey, DrumGroup[]>();

  for (const item of remaining) {
    if (hasRcraCode(item)) {
      // Try existing hazardous drums first (compatible + room).
      const fit = hazardousDrums.find(
        (d) => isCompatibleWithDrum(item, d.items) && volumeSum(d.items) + volumeGal(item.containerSize) <= DEFAULT_DRUM_VOLUME_CAP_GAL
      );
      if (fit) {
        fit.items.push(item);
      } else {
        const drum = newDrum("hazardous");
        drum.items.push(item);
        hazardousDrums.push(drum);
      }
      continue;
    }

    // Non-RCRA: per the client's 2026-09-26 directive, non-RCRA materials
    // default to being packaged TOGETHER in their own category drum(s),
    // separate from hazardous-waste drums -- joining a hazardous drum is
    // a deliberate human exception (the review screen's "Combine with…"
    // action), never an automatic fallback just because Appendix V found
    // no specific incompatible pair. A category drum can always be
    // started, so there is no "no category slot available" case that
    // would justify falling back to a hazardous drum here.
    const suggestedKey = suggestPackCategory({ chemicalName: item.chemicalName, hazardClass: item.hazardClass }) ?? "non_haz_general";
    const existingForCategory = categoryDrums.get(suggestedKey) ?? [];
    const categoryFit = existingForCategory.find(
      (d) => isCompatibleWithDrum(item, d.items) && volumeSum(d.items) + volumeGal(item.containerSize) <= DEFAULT_DRUM_VOLUME_CAP_GAL
    );
    if (categoryFit) {
      categoryFit.items.push(item);
      continue;
    }

    const drum = newDrum(suggestedKey);
    drum.items.push(item);
    existingForCategory.push(drum);
    categoryDrums.set(suggestedKey, existingForCategory);
  }

  for (const drum of drums) finalizeDrum(drum);
  return drums;
}

export { PACK_CATEGORIES };
