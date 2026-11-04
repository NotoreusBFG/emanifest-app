/**
 * Release notes, development milestones and tracked benchmarks for the
 * admin-only, non-production Dev Dashboard (/dev-dashboard).
 *
 * Maintained by hand: add an entry whenever something ships, a milestone moves,
 * or a benchmark is re-measured, and bump the asOf date. Only record things that
 * were actually done or measured; leave a benchmark "unknown" rather than guess.
 * Commit hashes refer to NotoreusBFG/emanifest-app.
 */
export type Environment = "Production" | "Dev" | "Both" | "Local";

export interface ReleaseNote {
  date: string; // YYYY-MM-DD
  title: string;
  environment: Environment;
  commits?: string;
  items: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: "2026-11-04",
    title: "EPA-alignment fixes and exception report overdue alerts go live",
    environment: "Production",
    commits: "1a3e928, dd6390c on main",
    items: [
      "Production RCRAInfo API path corrected to /rcrainfoprod/ in client.ts.",
      "Waste-line quantities must be whole numbers (EPA schema integer, 0 to 99,999,999,999); form inputs and submit validation updated.",
      "Signing dialog now states the Remote Signer conditions (same company, first-hand knowledge, 24 hours) and the Box 15 rule.",
      "Exception report article rewritten: 45-day search, 60-day filing, electronic filing since 12/1/2025 (Certifier role).",
      "FAQ and getting-registered corrections: permissions, shared credentials, rejections, missing signed copies, EPA fees, preprod versus production.",
      "Dashboard warns when a manifest has no signed facility copy at day 45 and day 60.",
      "Production promoted out of the Oct 12 Instant Rollback state; pushes to main deploy automatically again.",
    ],
  },
  {
    date: "2026-11-04",
    title: "Exception Report reminder emails (dev only for now)",
    environment: "Dev",
    commits: "e94a949, fa32683, d1dc852 on dev",
    items: [
      "Daily digest email to the account owner for manifests newly past day 45 and day 60; one email per manifest per stage.",
      "Settings toggle to opt out; new tables exception_report_reminders and exception_report_email_optout (migration 2026110401, applied to the sandbox database only).",
      "Daily trigger is a GitHub Actions schedule (13:00 UTC) because Vercel does not run crons on Preview builds. The workflow file is on main too, since GitHub schedules only run from the default branch.",
      "Tested end to end with two backdated test manifests: one digest email delivered, a second run sent nothing. Test rows removed.",
      "Email links now point at the site that sent them.",
    ],
  },
  {
    date: "2026-11-04",
    title: "Dev Dashboard (this page)",
    environment: "Dev",
    items: [
      "Admin-only, non-production page: EPA reference documents versus ManifestMate coverage, release notes, milestones and benchmarks.",
    ],
  },
  {
    date: "2026-11-03",
    title: "EPA e-Manifest deep dive baseline",
    environment: "Local",
    items: [
      "Read the EPA fact sheets, Advisory Board materials, rules, webinars and the developer repository against ManifestMate's design.",
      "Weekly page-watch (Mondays 07:30) and monthly deep-dive (2nd of the month, 06:00) skills and cron jobs created.",
    ],
  },
  {
    date: "2026-10-13",
    title: "Production release plan written",
    environment: "Dev",
    commits: "fe00667",
    items: ["Phased dev to main plan (schema first, then code, then feature exposure) with a weekly drift check."],
  },
  {
    date: "2026-10-12",
    title: "Production rolled back after serving a dev build",
    environment: "Production",
    items: ["Vercel source was mis-set so production ran dev code against a database missing its migrations; rolled back to main (cba8cb8). Lifted on 2026-11-04."],
  },
];

export type MilestoneStatus = "done" | "in-progress" | "planned" | "blocked" | "watch";

export interface Milestone {
  title: string;
  status: MilestoneStatus;
  date?: string; // completed date or target / external date
  note: string;
}

export const MILESTONES: Milestone[] = [
  { title: "EPA deep dive baseline and sheet-by-sheet comparison", status: "done", date: "2026-11-04", note: "13 fact sheets compared for production and dev; findings in the EPA coverage tab." },
  { title: "Content and validation fixes live on production", status: "done", date: "2026-11-04", note: "Prod URL, integer quantities, signing text, KB, exception article, overdue alerts." },
  { title: "Exception Report reminder emails on dev", status: "done", date: "2026-11-04", note: "Verified with a real delivered email on the sandbox." },
  { title: "Exception Report reminder emails on production", status: "blocked", note: "Needs migration 2026110401 on the production database, CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY in the emanifest-app Vercel project, and a production job and secret in the GitHub workflow." },
  { title: "Phased dev to main release", status: "planned", note: "Production database is missing 32 dev-only migrations (Oct 13 baseline) plus 2026110401. Follow docs/prod-release-plan.md: schema first, then code, then feature exposure." },
  { title: "Finish reading remaining EPA documents", status: "in-progress", note: "Still unread: White Paper sections 1 to 3.1.4, 3.1.5.1 to 3.1.5.2 and 7 to 9, the Sept 2025 transcript, earlier Board materials; One Year Rule and Sunset Rule partly read." },
  { title: "Exception Report filing support", status: "planned", note: "Alerts and reminders exist; filing in e-Manifest (Certifier role) is not built." },
  { title: "Broker Item 14 statement helper and Broker ID prompt", status: "planned", note: "Proposed Sunset Rule provision and a Board recommendation; cheap differentiator for broker accounts." },
  { title: "Hybrid manifest decision", status: "planned", note: "EPA keeps hybrid after the sunset; paper-manifest design currently excludes it." },
  { title: "Add NotAssigned to the manifest status type", status: "planned", note: "Value exists in EPA's schema; our type omits it." },
  { title: "Align onboarding links with the RCRAInfo environment", status: "planned", note: "Links point at production RCRAInfo while the app runs on preprod; fix before go-live." },
  { title: "Test Scheduled-status behaviour with a TSDF that disallows other sites scheduling", status: "planned", note: "Not tested against live RCRAInfo." },
  { title: "Confirm paper form revision for the overlay (4-copy versus 5-copy)", status: "planned", note: "4-copy form effective 1/22/2025; the old form is still accepted until further notice." },
  { title: "Re-record Module 2 Scene 4 training narration", status: "planned", note: "Script and quiz are corrected; the recorded narration still carries the old claim." },
  { title: "Paper Manifest Sunset Rule final rule", status: "watch", date: "~2027", note: "EPA expects the final rule in 2027; ends paper 24 months after. Tracked by the weekly watch." },
  { title: "EPA user fee schedule for FY2028/29", status: "watch", date: "by 2027-07-01", note: "Fees fall on receiving facilities and exporters; update the FAQ when published." },
  { title: "Advisory Board charter renewal", status: "watch", date: "~2027-08", note: "Charter filed Aug 13, 2025 for two years." },
];

export type BenchmarkStatus = "on-track" | "attention" | "blocked" | "unknown";

export interface Benchmark {
  name: string;
  current: string;
  target: string;
  status: BenchmarkStatus;
  note: string;
  asOf: string;
}

/** Static benchmarks. Coverage figures are computed live from devDashboardData on the page. */
export const BENCHMARKS: Benchmark[] = [
  { name: "Typecheck (tsc --noEmit), dev branch", current: "Passing", target: "Always passing", status: "on-track", note: "Run before each push.", asOf: "2026-11-04" },
  { name: "Production build (next build), main", current: "Passing", target: "Always passing", status: "on-track", note: "Caught a real error in the main-branch cherry-pick before it shipped.", asOf: "2026-11-04" },
  { name: "Automated tests", current: "No test runner configured (manual scripts/test-*.ts only)", target: "Automated tests for validation and timing helpers", status: "attention", note: "Logic such as exceptionReportTiming and quantity validation was checked by hand only.", asOf: "2026-11-04" },
  { name: "Branch drift (commits only on dev / only on main)", current: "84 / 6", target: "Shrinking toward release", status: "attention", note: "Large drift is the main release risk; see the phased plan.", asOf: "2026-11-04" },
  { name: "Production database migrations pending", current: "32 dev-only + 2026110401", target: "0 before code ships", status: "blocked", note: "Code must never go live before its schema (Oct 12 incident).", asOf: "2026-11-04" },
  { name: "Exception report reminder job", current: "Last run succeeded (dev)", target: "Daily 13:00 UTC without failures", status: "on-track", note: "First scheduled run is the next 13:00 UTC; manual runs succeeded.", asOf: "2026-11-04" },
  { name: "Time from EPA finding to production fix", current: "1 day", target: "Under 1 week", status: "on-track", note: "Deep dive 2026-11-03, fixes live on production 2026-11-04. Re-measure each monthly dive.", asOf: "2026-11-04" },
  { name: "EPA watch jobs", current: "Scheduled", target: "Weekly Mon 07:30, monthly 2nd 06:00", status: "unknown", note: "Cron jobs created 2026-11-03; first scheduled runs not yet observed. First calendar event needs a manual check.", asOf: "2026-11-04" },
  { name: "Share of ManifestMate manifests submitted electronically", current: "100% by design", target: "100%", status: "on-track", note: "No paper or hybrid path yet (see the hybrid milestone). EPA reports under 1% of about 2 million annual manifests are fully electronic.", asOf: "2026-11-04" },
  { name: "Live behaviour tested against RCRAInfo production", current: "Not tested", target: "Tested at go-live", status: "attention", note: "ManifestMate runs on EPA preprod; production URL and quantity rejection are unconfirmed.", asOf: "2026-11-04" },
];
