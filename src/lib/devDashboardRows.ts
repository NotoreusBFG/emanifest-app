import feed from "./devDashboardFeed.json";
import { DEV_DASHBOARD_ROWS, type DevDashboardRow, type CoverageStatus, type ReviewDepth } from "./devDashboardData";

/**
 * Entries appended automatically by the EPA watch skills
 * (epa-emanifest-page-watch weekly, epa-emanifest-deep-dive monthly) to
 * devDashboardFeed.json. Anything not yet assessed shows up in the EPA coverage
 * table as "Not assessed yet" under FEED_CATEGORY; a deep dive that has read the
 * document supplies status/solution/strengths so it renders as a normal row.
 * The file is machine-written: edit devDashboardData.ts for hand-curated rows,
 * and move an assessed feed entry there when convenient.
 */
export interface FeedEntry {
  id: string;
  date: string; // YYYY-MM-DD the watch found it
  source: string; // e.g. "weekly watch", "monthly deep dive"
  kind: string; // page | federal-register | github | meeting | webinar | fact-sheet | other
  title: string;
  detail: string;
  url?: string;
  category?: string;
  reviewed?: ReviewDepth;
  status?: CoverageStatus;
  solution?: string;
  strengths?: DevDashboardRow["strengths"];
}

export const FEED_CATEGORY = "New from the EPA watch";
export const FEED_ENTRIES = feed as FeedEntry[];

export const FEED_ROWS: DevDashboardRow[] = FEED_ENTRIES.map((e) => ({
  category: e.category ?? FEED_CATEGORY,
  title: e.title,
  detail: `Found ${e.date} by the ${e.source}. ${e.detail}`,
  url: e.url,
  reviewed: e.reviewed ?? "Not yet reviewed",
  status: e.status ?? "unassessed",
  solution:
    e.solution ??
    `Not assessed yet. Added automatically on ${e.date}; the monthly deep dive reads it in full and fills this in.`,
  strengths: e.strengths ?? {},
}));

/** Newest feed entries first. */
export const FEED_NEWEST = [...FEED_ENTRIES].sort((a, b) => b.date.localeCompare(a.date));

/** Feed rows first so new EPA material is the first thing in the table. */
export const ALL_ROWS: DevDashboardRow[] = [...FEED_ROWS, ...DEV_DASHBOARD_ROWS];
