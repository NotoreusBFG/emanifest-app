/**
 * Cold-call priority within a category — favors whoever can actually say
 * yes on the spot (owner) over someone who has to check with someone else.
 * Rank 0 is best. Matches the "who to call first" logic worked out by hand
 * for the Henrico AUTO tier, generalized so it applies to every category.
 */
export function contactPriorityRank(contactName: string | null, contactTitle: string | null): number {
  if (!contactName) return 3;
  const title = (contactTitle ?? "").toLowerCase();
  if (title.includes("owner") || title.includes("president") || title.includes("ceo") || title.includes("founder")) {
    return 0;
  }
  if (title.includes("director") || title.includes("manager") || title.includes("vp") || title.includes("vice president")) {
    return 1;
  }
  return 2;
}

/**
 * Category display order for the call sheet — matches the priority order
 * from henrico-county-plan.md's "Recommended calling priority" section:
 * small/owner-decides businesses first, chains/institutions/large
 * single-site corporates last (they route to a separate corporate-outreach
 * motion, not a cold call).
 */
export const CATEGORY_CALL_ORDER = ["AUTO", "CLEANER", "OTHER-SMALL", "SCHOOL", "GOV", "OTHER-CORP", "CHAIN"];

export function categoryRank(category: string | null): number {
  if (!category) return CATEGORY_CALL_ORDER.length;
  const idx = CATEGORY_CALL_ORDER.indexOf(category);
  return idx === -1 ? CATEGORY_CALL_ORDER.length : idx;
}
