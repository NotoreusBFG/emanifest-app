import dotLabPackExclusions from "./dotLabPackExclusions.json";

/**
 * Lab pack regulatory compliance checks -- researched and verified against
 * raw regulation text (eCFR XML, not summarized web results) 2026-09-13.
 * All findings here are surfaced as WARNINGS, never a hard block on
 * saving: the human packer may know something this app doesn't (a
 * specific DOT special permit, a state-specific allowance, more complete
 * information about the actual waste stream than a name/code alone
 * conveys). See feedback from the user: "We may never fully know what
 * the situation is for the chemist packing the chemicals, so we need to
 * keep the system open, but warned."
 */

interface DotLabPackExclusionEntry {
  name: string;
  hazardClass: string;
  packingGroup: string;
}

/** Pre-filtered from src/lib/hazmat/table.json (the full 49 CFR 172.101
 * table, ~2MB) down to just Division 6.1 Packing Group I and Division
 * 2.3 entries -- the two DOT classifications relevant to the
 * poison-by-inhalation / Packing Group I exclusion below. This module is
 * imported into the live client-side lab pack form, so it deliberately
 * does NOT pull in the full table (367 entries / ~45KB here vs. ~2MB for
 * the whole table) -- regenerate with:
 *   node -e "const t=require('./src/lib/hazmat/table.json');
 *   require('fs').writeFileSync('src/lib/labPack/dotLabPackExclusions.json',
 *   JSON.stringify(t.filter(e=>!e.isCrossReference&&((e.hazardClass==='6.1'
 *   &&e.packingGroup.trim().toUpperCase()==='I')||e.hazardClass==='2.3'))
 *   .map(e=>({name:e.properShippingName,hazardClass:e.hazardClass,
 *   packingGroup:e.packingGroup.trim().toUpperCase()})), null, 2))"
 * if the source table is ever updated. */
const DOT_EXCLUSIONS = dotLabPackExclusions as DotLabPackExclusionEntry[];

export interface LabPackComplianceWarning {
  /** Stable id for dedup/testing -- not shown to the user. */
  id: string;
  message: string;
}

/**
 * EPA hazardous waste numbers that may NEVER use the lab-pack alternative
 * treatment standard, regardless of how they're packaged -- 40 CFR
 * 268.42(c)(2), cross-referencing Appendix IV to Part 268 ("Wastes
 * Excluded From Lab Packs Under the Alternative Treatment Standards of
 * § 268.42(c)"). Verified against the raw eCFR text directly.
 */
export const LAB_PACK_EXCLUDED_WASTE_CODES = new Set([
  "D009",
  "F019",
  "K003",
  "K004",
  "K005",
  "K006",
  "K062",
  "K071",
  "K100",
  "K106",
  "P010",
  "P011",
  "P012",
  "P076",
  "P078",
  "U134",
  "U151",
]);

const CHLORIC_ACID_OLEUM_PATTERN = /chloric acid|oleum|fuming sulfuric acid/i;

/** A material's DOT classification is "Division 6.1, Packing Group I" or
 * a Division 2.3 gas -- both are treated by 49 CFR 173.12(b)(3) as
 * excluded from the lab-pack packaging exception (Division 2.3 gases are
 * inherently poison-by-inhalation; Division 6.1 PG I liquids/solids
 * assigned an inhalation Hazard Zone are the other poison-by-inhalation
 * case named in that paragraph -- Hazard Zone A/B are sub-tiers that only
 * exist within Packing Group I, so a PG I check already covers every
 * Zone A material as a subset, even though this app doesn't have the
 * LC50 data to distinguish Zone A/B from a PG I material that's PG I for
 * oral/dermal toxicity instead). Looked up by chemical name against the
 * app's own 49 CFR 172.101 hazmat table -- an approximate match, not
 * guaranteed to find every real-world synonym. */
function isDotExcludedFromLabPack(chemicalName: string): { excluded: boolean; reason: string | null } {
  const name = chemicalName.trim();
  if (!name) return { excluded: false, reason: null };
  if (CHLORIC_ACID_OLEUM_PATTERN.test(name)) {
    return { excluded: true, reason: "chloric acid / oleum (fuming sulfuric acid) -- excluded outright by 49 CFR 173.12(b)(3)" };
  }

  const lowerName = name.toLowerCase();
  // Prefer an exact (or "X, solid"/"X, stabilized"-style near-exact) name
  // match over a loose substring one -- otherwise typing "Potassium
  // cyanide" can match a DIFFERENT, unrelated compound like "Mercuric
  // potassium cyanide" purely because the substring appears inside it.
  const exactMatch = DOT_EXCLUSIONS.find((e) => {
    const entryName = e.name.toLowerCase();
    return entryName === lowerName || entryName.startsWith(`${lowerName},`) || entryName.startsWith(`${lowerName} `);
  });
  const match = exactMatch ?? DOT_EXCLUSIONS.find((e) => e.name.toLowerCase().includes(lowerName));
  if (!match) return { excluded: false, reason: null };

  if (match.hazardClass === "2.3") {
    return { excluded: true, reason: `Division 2.3 poison gas ("${match.name}") -- inherently poison-by-inhalation, excluded by 49 CFR 173.12(b)(3)` };
  }
  return {
    excluded: true,
    reason: `Division 6.1, Packing Group I ("${match.name}") -- excluded from the standard lab-pack combination rule by 49 CFR 173.12(b)(3); a Hazard Zone A/B material is a subset of this`,
  };
}

/** EPA's "Examples of Potentially Incompatible Waste" (40 CFR Part 264,
 * Appendix V, cited by the RCRA "incompatible waste" definition in
 * §264.17/265.17) -- six A/B group pairs; mixing an A-group material with
 * its paired B-group material risks the named hazard. Verified against
 * the raw eCFR text directly, quoted where practical.
 *
 * Classification here is a best-effort NAME-KEYWORD match, not
 * authoritative chemistry -- it exists to flag likely incompatibilities
 * for a human to look at, not to replace a real chemical compatibility
 * determination. A chemical can (and often does) match zero, one, or
 * multiple groups.
 */
type CompatGroup = "1-A" | "1-B" | "2-A" | "2-B" | "3-A" | "3-B" | "4-A" | "4-B" | "5-A" | "5-B" | "6-A" | "6-B";

const COMPAT_GROUP_PAIRS: [CompatGroup, CompatGroup, string][] = [
  ["1-A", "1-B", "Heat generation; violent reaction (alkaline/caustic mixed with acid)"],
  ["2-A", "2-B", "Fire or explosion; generation of flammable hydrogen gas (reactive metal mixed with acid/alkaline waste)"],
  ["3-A", "3-B", "Fire, explosion, or heat generation; flammable or toxic gases (alcohol/water mixed with a water-reactive material)"],
  ["4-A", "4-B", "Fire, explosion, or violent reaction (reactive organic mixed with concentrated acid/alkaline or a reactive metal)"],
  ["5-A", "5-B", "Generation of toxic hydrogen cyanide or hydrogen sulfide gas (cyanide/sulfide mixed with acid)"],
  ["6-A", "6-B", "Fire, explosion, or violent reaction (strong oxidizer mixed with an organic acid or flammable material)"],
];

/** Keyword -> every compatibility group that keyword's presence in a
 * chemical name implies. Order doesn't matter; a name can hit several. */
const GROUP_KEYWORDS: [RegExp, CompatGroup[]][] = [
  [/hydroxide|caustic|\balkal/i, ["1-A"]],
  [/\bacetic acid\b/i, ["6-B", "1-B"]],
  [/\bacid\b/i, ["1-B"]],
  [/\baluminum\b|\bberyllium\b|\bcalcium\b(?!\s*hypochlorite)|\blithium\b|\bmagnesium\b|\bpotassium\b(?!\s*(cyanide|permanganate|chlorate|perchlorate|hydroxide))|\bsodium\b(?!\s*(cyanide|hydroxide|hypochlorite))|zinc powder/i, ["2-A"]],
  [/\balcohol\b|\bethanol\b|\bmethanol\b|\bisopropanol\b|\bisobutanol\b/i, ["3-A", "4-A"]],
  [/\bwater\b/i, ["3-A"]],
  [/aldehyde|halogenated hydrocarbon|nitrated hydrocarbon|\btrichloroethylene\b|\btetrachloroethylene\b|\bmethylene chloride\b|unsaturated hydrocarbon/i, ["4-A"]],
  [/cyanide|sulfide/i, ["5-A"]],
  [/chlorate|chlorite|hypochlorite|nitrate\b|nitric acid|perchlorate|permanganate|peroxide|chromic acid|\bchlorine\b/i, ["6-A"]],
];

export function classifyCompatibilityGroups(chemicalName: string): CompatGroup[] {
  const groups = new Set<CompatGroup>();
  for (const [pattern, matchGroups] of GROUP_KEYWORDS) {
    if (pattern.test(chemicalName)) matchGroups.forEach((g) => groups.add(g));
  }
  return Array.from(groups);
}

function checkPairwiseCompatibility(chemicalNames: string[]): LabPackComplianceWarning[] {
  const warnings: LabPackComplianceWarning[] = [];
  const classified = chemicalNames.map((name) => ({ name, groups: classifyCompatibilityGroups(name) }));

  for (let i = 0; i < classified.length; i++) {
    for (let j = i + 1; j < classified.length; j++) {
      const a = classified[i];
      const b = classified[j];
      for (const [groupA, groupB, hazard] of COMPAT_GROUP_PAIRS) {
        const aHasA = a.groups.includes(groupA);
        const bHasB = b.groups.includes(groupB);
        const aHasB = a.groups.includes(groupB);
        const bHasA = b.groups.includes(groupA);
        if ((aHasA && bHasB) || (aHasB && bHasA)) {
          warnings.push({
            id: `incompatible-${a.name}-${b.name}-${groupA}${groupB}`,
            message: `"${a.name}" and "${b.name}" may be chemically incompatible (EPA Appendix V groups ${groupA}/${groupB}) -- possible ${hazard}. Verify actual compatibility before packing together.`,
          });
        }
      }
    }
  }
  return warnings;
}

export function checkLabPackCompliance(input: {
  wasteCodes: string[];
  dotShippingDescription: string;
  isNonHazardous: boolean;
  lineItems?: { chemicalName: string }[];
}): LabPackComplianceWarning[] {
  if (input.isNonHazardous) return [];

  const warnings: LabPackComplianceWarning[] = [];

  const excludedCodes = input.wasteCodes.filter((c) => LAB_PACK_EXCLUDED_WASTE_CODES.has(c.trim().toUpperCase()));
  if (excludedCodes.length > 0) {
    warnings.push({
      id: `excluded-waste-code-${excludedCodes.join("-")}`,
      message: `Waste code(s) ${excludedCodes.join(", ")} may not use the lab-pack alternative treatment standard (40 CFR 268.42(c)(2) / Appendix IV to Part 268) -- this waste stream needs a different LDR treatment path, not a lab pack.`,
    });
  }

  const namesToCheck = [
    ...(input.lineItems ?? []).map((li) => li.chemicalName),
    input.dotShippingDescription,
  ].filter((n) => n.trim() !== "");
  const flagged: { name: string; reason: string }[] = [];
  const seenNames = new Set<string>();
  for (const name of namesToCheck) {
    const { excluded, reason } = isDotExcludedFromLabPack(name);
    if (excluded && reason && !seenNames.has(name.trim().toLowerCase())) {
      seenNames.add(name.trim().toLowerCase());
      flagged.push({ name, reason });
    }
  }
  if (flagged.length === 1) {
    const { name, reason } = flagged[0];
    warnings.push({
      id: `excluded-dot-description-${name}`,
      message: `"${name}" looks like ${reason}. Per 49 CFR 173.12(b)(3) this can't share a standard combination lab pack with other materials -- it would need its own single-substance packaging (e.g. §173.226(c) for Division 6.1 PG I). Flagging for manual review, not blocking: confirm the actual classification and packaging before shipping.`,
    });
  } else if (flagged.length > 1) {
    const names = flagged.map((f) => `"${f.name}"`).join(", ");
    warnings.push({
      id: `excluded-dot-description-multi-${flagged.map((f) => f.name).join("-")}`,
      message: `Multiple materials in this drum look like Division 6.1 Packing Group I / Division 2.3 (${names}). Per 49 CFR 173.12(b)(3) this classification generally can't share a standard combination lab pack with ANY other material -- if these are genuinely the same acutely toxic class and you're packing them together intentionally, confirm that's correct for your actual waste stream before shipping; otherwise each may need its own single-substance packaging (e.g. §173.226(c)).`,
    });
  }

  if (input.lineItems && input.lineItems.length > 1) {
    warnings.push(...checkPairwiseCompatibility(input.lineItems.map((li) => li.chemicalName)));
  }

  return warnings;
}
