/**
 * Data for the admin-only, non-production "Dev Dashboard" (/dev-dashboard):
 * EPA reference documents for e-Manifest, what ManifestMate does (or lacks)
 * for each, and where it meets or exceeds EPA's expectations.
 *
 * Source: the November 2026 EPA e-Manifest deep dive (report-2026-11.md and
 * comparison-2026-11.md in ~/epa-emanifest-watch/deep-dive/). Signed-in screens
 * were judged from code, and nothing here was tested against live RCRAInfo
 * production. Update this file when the monthly deep dive finds changes.
 */
export type CoverageStatus = "covered" | "partial" | "gap" | "n/a" | "unassessed";
export type ReviewDepth = "Full" | "Key sections" | "Most sections" | "Not yet reviewed";

export interface DevDashboardRow {
  category: string;
  title: string;
  detail: string; // issuer / date / one-line description
  url?: string;
  reviewed: ReviewDepth;
  status: CoverageStatus;
  /** ManifestMate's solution, or the lack of one. */
  solution: string;
  /** Where ManifestMate meets or exceeds EPA's expectations. Omit a key if there is nothing honest to say. */
  strengths: { development?: string; solutions?: string; customer?: string };
}

export const DEV_DASHBOARD_AS_OF = "2026-11-04";

export const STATUS_LABELS: Record<CoverageStatus, string> = {
  covered: "Meets / exceeds",
  partial: "Partial",
  gap: "Gap",
  "n/a": "Not a ManifestMate user",
  unassessed: "Not assessed yet",
};

const FACT_SHEETS = "https://www.epa.gov/e-manifest/e-manifest-fact-sheets-user-type";

export const DEV_DASHBOARD_ROWS: DevDashboardRow[] = [
  // ---------------------------------------------------------------- Law and rules
  {
    category: "Statute and rules",
    title: "Hazardous Waste Electronic Manifest Establishment Act (Pub. L. 112-195)",
    detail: "Congress, Oct 5, 2012. Creates the national e-Manifest system; the signature must preserve legal accountability for the certifier and the receiver.",
    url: "https://www.congress.gov/112/plaws/publ195/PLAW-112publ195.pdf",
    reviewed: "Full",
    status: "covered",
    solution:
      "ManifestMate is a front end over EPA's RCRAInfo e-Manifest API, not a separate manifest system. Every manifest, signature and status lives in EPA's system; ManifestMate keeps a local mirror for the dashboard.",
    strengths: {
      development: "Uses only EPA's published REST services; no shadow record of truth to reconcile.",
      customer: "Signing dialogs state who EPA records as the certifier, which keeps the legal-accountability point visible to users.",
    },
  },
  {
    category: "Statute and rules",
    title: "One Year Rule (2014-01352)",
    detail: "EPA, Feb 2014. Electronic manifests must come from EPA's national system; competing private systems were dropped.",
    url: "https://www.federalregister.gov/d/2014-01352",
    reviewed: "Key sections",
    status: "covered",
    solution: "Design follows the rule: ManifestMate prepares and submits through EPA's system and does not issue its own manifests or tracking numbers.",
    strengths: {
      development: "Architecture matches the rule's intent, so no regulatory exposure from running an alternate system.",
    },
  },
  {
    category: "Statute and rules",
    title: "Manifest form and procedures final rule (83 FR 420, 2017-27788)",
    detail: "EPA, Jan 3, 2018. Revised manifest form, procedures and electronic submission requirements.",
    url: "https://www.govinfo.gov/content/pkg/FR-2018-01-03/pdf/2017-27788.pdf",
    reviewed: "Key sections",
    status: "partial",
    solution:
      "Classic form, wizard (dev) and CSV import capture the revised form's data. Waste-line quantities are now validated as whole numbers before submit (live on production 2026-11-04). Open item: confirm which paper form revision the paper-manifest overlay targets (4-copy form effective 1/22/2025 versus the older 5-copy form).",
    strengths: {
      solutions: "CSV import and DOT hazardous materials table lookup reduce data-entry errors on the manifest.",
    },
  },
  {
    category: "Statute and rules",
    title: "Paper Manifest Sunset Rule, proposed (2026-04366)",
    detail: "EPA, published Mar 5, 2026, docket EPA-HQ-OLEM-2025-3456. Ends paper 24 months after the final rule (expected about 2027); hybrid stays; broker statement in Item 14; wider registration.",
    url: "https://www.federalregister.gov/d/2026-04366",
    reviewed: "Key sections",
    status: "partial",
    solution:
      "Electronic path is fully supported. No hybrid manifest support, no Item 14 broker statement helper, no Broker ID prompt. The planned paper-manifest overlay has a limited lifespan under this rule.",
    strengths: {
      solutions: "Electronic-first design already matches where EPA is heading; delegation and driver signing links work without the signer needing RCRAInfo access.",
      customer: "Registration and onboarding guidance (tracked checklist, University) fits the registration push the rule would create.",
    },
  },
  // ---------------------------------------------------------------- Policy
  {
    category: "EPA policy and guidance",
    title: "Remote Signer Policy memo",
    detail: "EPA OLEM, May 5, 2023. A field person with first-hand knowledge may sign remotely; their printed name goes on the manifest; sign within 24 hours or before transfer.",
    url: "https://rcrapublic.epa.gov/files/14956.pdf",
    reviewed: "Full",
    status: "covered",
    solution:
      "Quick-Sign delegation uses the owner's API credentials (the policy's system-to-system method) and tokenized driver/generator signing links capture the signer's printed name and a sign-confirmation clickwrap. The 24-hour window is stated in the dialog text, not enforced in code.",
    strengths: {
      development: "Tokenized links let an unregistered driver sign with their own printed name, which is what the policy intends.",
      solutions: "Delegation stays inside the company's own credentials, avoiding the shared-login practice EPA prohibits.",
      customer: "Fixed 2026-11-04 (live on production): the signing dialog now states the delegate conditions (same company, first-hand knowledge, 24 hours) and the Box 15 rule for who may sign as generator, replacing text that overstated what EPA records.",
    },
  },
  {
    category: "EPA policy and guidance",
    title: "e-Manifest Frequently Asked Questions",
    detail: "EPA web page, current.",
    url: "https://www.epa.gov/e-manifest/frequent-questions-about-e-manifest",
    reviewed: "Full",
    status: "covered",
    solution:
      "ManifestMate's FAQ and University were reconciled with EPA's FAQ on 2026-11-03: permissions, shared credentials, rejections, missing signed copies, fees, registration scope and preprod versus production. The corrections are live on production as of 2026-11-04.",
    strengths: {
      customer: "Plain-language FAQ plus Haz Waste University goes well beyond a link list; wrong or stale answers found in the review were corrected and the production site now serves them.",
    },
  },
  {
    category: "EPA policy and guidance",
    title: "e-Manifest Advisory Board FAQ",
    detail: "EPA web page, current. Board role, meetings, how to participate.",
    url: "https://www.epa.gov/e-manifest/frequent-questions-about-hazardous-waste-electronic-manifest-system-e-manifest-advisory",
    reviewed: "Full",
    status: "n/a",
    solution: "Program governance information; no product requirement. The weekly watch job tracks the meetings and puts them on Matt's calendar.",
    strengths: {
      development: "Automated weekly and monthly EPA watch (page diffs, Federal Register, GitHub, meeting calendar) keeps design decisions current.",
    },
  },
  {
    category: "EPA policy and guidance",
    title: "USEPA/e-manifest developer repository",
    detail: "GitHub: JSON schema, API services documentation, Python client. Schema last changed July 2026; PATCH services removed in client v5.0.0.",
    url: "https://github.com/USEPA/e-manifest",
    reviewed: "Full",
    status: "partial",
    solution:
      "Client uses save, update, search, get, attachments and quicker-sign only; no deprecated PATCH calls. Production host path corrected on 2026-11-03. Open: add the NotAssigned status to the status type; export consent numbers and foreign-address fields only matter if exports are ever added.",
    strengths: {
      development: "Fixed 2026-11-04 (production and dev): the schema's integer quantity rule (0 to 99,999,999,999) is enforced before submit, so users get a clear message instead of an EPA API rejection. Decimal quantities were previously accepted and sent.",
    },
  },
  // ---------------------------------------------------------------- Fact sheets
  {
    category: "EPA fact sheets by user type",
    title: "Generators fact sheet",
    detail: "EPA, Apr 2026. Three manifest options (paper, electronic, hybrid); registration; Exception Reports filed electronically.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "partial",
    solution:
      "Create and sign electronically works end to end. Added 2026-11-04: Exception Report overdue alerts (day 45 find the signed copy, day 60 report due) on the dashboard, live on production; a daily reminder email with a Settings opt-out, on dev only until the production database and variables are ready. Whole-number quantity validation and the corrected exception report article are live on production. Gaps: no Exception Report filing, no hybrid manifests, no handling for generators without an EPA ID, no post-receipt corrections.",
    strengths: {
      development: "Creates manifests through the API rather than only through RCRAInfo screens; CSV import from a generator's own systems.",
      solutions: "Waste profiles, labels, lab packs, bills of lading and LDR notices go beyond what e-Manifest collects (dev adds wizard and profiles).",
      customer: "Tracked onboarding to API credentials with videos; DOT table and waste code search; overdue alerts and (on dev) reminder emails tell users when the Exception Report clock matters, which EPA's sheet leaves to the generator to track.",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "Transporters fact sheet",
    detail: "EPA, Dec 2020 (still current).",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "covered",
    solution:
      "Multiple transporters per manifest, transporter signing at Preparer level via Quick Sign, driver signing links, transporter invite and management pages and a transporter dashboard.",
    strengths: {
      development: "Driver signing needs no RCRAInfo registration.",
      solutions: "Delegation and signing links exceed the sheet's expectation of an individually registered signer.",
      customer: "Elapsed in-transit timing on the dashboard. Open: the 24-hour remote-signer window is not enforced in code.",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "Brokers fact sheet",
    detail: "EPA, Dec 2020 (updated Aug 2026). Brokers prepare manifests for clients, cannot sign for generators unless on site as an offeror, need their own EPA ID.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "partial",
    solution:
      "Dev has third-party (broker/consultant) accounts with an approved customer list, profiles, labels and the wizard. Production has no broker account type. Neither branch has the proposed Item 14 broker statement or a Broker ID prompt, and nothing blocks a broker holding a Generator-role delegation beyond dialog text.",
    strengths: {
      solutions: "Preparation tooling for brokers (customer approval, profile reuse, labels) exceeds what the sheet describes.",
      customer: "Broker limits are explained in the FAQ and signing dialog.",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "Receiving facilities fact sheet",
    detail: "EPA, Dec 2020. Final submission, corrections, discrepancy reports, rejections, invoices.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "gap",
    solution:
      "Out of ManifestMate's target audience. There is a facility signing role (initial receipt via Quick Sign) but no final CROMERR submission, corrections, discrepancy reports, rejection handling or invoice support.",
    strengths: {
      customer: "FAQ explains who pays EPA fees (receiving facilities and exporters, not generators, transporters or brokers) so customers are not surprised.",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "Site Managers fact sheet",
    detail: "EPA, May 2022. Role duties, two Site Managers per EPA ID, Electronic Signature Agreement, API credentials.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "covered",
    solution:
      "Tracked onboarding checklist covers Site Manager role, ESA and API credential generation; credentials are stored encrypted. The University now carries a preprod-versus-production callout (live 2026-11-04). Still open: the onboarding links themselves point at production RCRAInfo while the app runs on preprod.",
    strengths: {
      customer: "A step-by-step tracked checklist with videos exceeds the sheet, which only lists duties.",
      development: "Encrypted credential storage and per-user credentials rather than shared logins.",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "Exporters fact sheet",
    detail: "EPA, Aug 2026. Export manifests, consent numbers, per-manifest fees, WIETS consistency.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "gap",
    solution: "No export manifest flow, consent number handling or international shipment fields. Not a current target.",
    strengths: {
      customer: "Scope is stated plainly so sales copy does not imply export coverage (see the scope decision in the gap list).",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "PCB waste handlers fact sheet",
    detail: "EPA, Sept 2024. PCB categories, TSCA versus RCRA IDs, state PCB codes.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "gap",
    solution: "No PCB or TSCA workflow. Dev's lab-pack tool flags PCB-related chemicals only. The Sunset Rule would add registration for PCB handlers, so this gap grows.",
    strengths: {},
  },
  {
    category: "EPA fact sheets by user type",
    title: "Billing fact sheet",
    detail: "EPA, Dec 2020. Fees and invoices for receiving facilities and exporters.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "n/a",
    solution: "ManifestMate users (generators, transporters, brokers) pay no EPA fees. The FAQ explains who pays, with the FY2026/27 amounts.",
    strengths: {
      customer: "Fee explanation in the FAQ answers a common customer question before it becomes a support ticket.",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "Emergency response and cleanup fact sheet",
    detail: "EPA, Dec 2020. Emergency or provisional EPA IDs, contractor signing, fee charge-back.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "partial",
    solution:
      "A default 24/7 emergency response phone number appears on every manifest and is editable. No workflow for emergency or provisional IDs, no-ID waivers, or contractor-signs-for-generator situations.",
    strengths: {
      customer: "Editable default emergency phone saves re-entry on every manifest.",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "General public fact sheet",
    detail: "EPA, Dec 2020. What e-Manifest is, data access, public availability 90 days after receipt.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "covered",
    solution:
      "University and FAQ cover the sheet's points. Not yet mentioned: manifest data becomes public 90 days after receipt, and EPA's preprod testing is open to the public.",
    strengths: {
      customer: "Haz Waste University goes well beyond the sheet on RCRA basics, DOT, state codes, LDR and transporter authority.",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "Inspectors fact sheet",
    detail: "EPA, Dec 2020. How inspectors see manifest data.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "n/a",
    solution: "Not a ManifestMate user type. Stored signed PDFs let customers hand an inspector a copy on request.",
    strengths: {
      customer: "Signed manifest PDFs are one click from the dashboard.",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "State program fact sheet",
    detail: "EPA, Dec 2020. State roles in e-Manifest.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "n/a",
    solution: "States are not users. Nothing in ManifestMate conflicts with states adopting the rules.",
    strengths: {
      solutions: "State waste codes are supported, which EPA does not expect from a front end.",
    },
  },
  {
    category: "EPA fact sheets by user type",
    title: "Tribes fact sheet",
    detail: "EPA, Dec 2020. Tribal roles in e-Manifest.",
    url: FACT_SHEETS,
    reviewed: "Full",
    status: "n/a",
    solution: "No tribal-specific features, and none are required.",
    strengths: {},
  },
  // ---------------------------------------------------------------- Advisory Board
  {
    category: "Advisory Board",
    title: "Advisory Board charter",
    detail: "EPA, filed Aug 13, 2025; two-year term, meets at least annually.",
    url: "https://www.epa.gov/e-manifest/hazardous-waste-electronic-manifest-system-e-manifest-advisory-board",
    reviewed: "Full",
    status: "n/a",
    solution: "Governance document, no product requirement. Renewal around Aug 2027 is on the watch list.",
    strengths: {},
  },
  {
    category: "Advisory Board",
    title: "Sept 23-24, 2025 meeting package: White Paper, charge questions, memo, deck, Board report",
    detail: "EPA and the e-Manifest Advisory Board, docket EPA-HQ-OLEM-2025-0391. Sunset options, proposed SMS/QR signature, MTN bank, outage plan, Board recommendations.",
    url: "https://www.regulations.gov/docket/EPA-HQ-OLEM-2025-0391",
    reviewed: "Most sections",
    status: "partial",
    solution:
      "EPA's proposed no-registration signature overlaps ManifestMate's delegated driver signing. Compatible with the MTN bank (dev labels already show the number as pending). Gaps: Broker ID prompt, zero-quantity manifests before shipment (ManifestMate rejects empty or zero quantities), 24 versus 72 hour remote-signer window.",
    strengths: {
      solutions: "Signing links already deliver, today, what EPA's proposed streamlined signature would later offer.",
      development: "Excel/CSV upload was a Board recommendation; ManifestMate's CSV import exists on both branches.",
      customer: "Training, videos and a knowledge base answer the Board's call for training and help resources.",
    },
  },
  {
    category: "Advisory Board",
    title: "Federal Register notices and requests for input (2024 to 2026)",
    detail: "Meeting notices (Aug 2024, Aug 2025), request for public input (2024), charge-question request (Feb 2026), nominations (Feb 2026).",
    url: "https://www.federalregister.gov",
    reviewed: "Full",
    status: "n/a",
    solution: "Informational. The weekly watch job calendars public meetings with join links and flags the first calendar event for a manual check.",
    strengths: {
      development: "Automation finds and schedules new Board meetings with registration and comment deadlines.",
    },
  },
  {
    category: "Advisory Board",
    title: "Sept 2025 meeting transcript and earlier Board meeting materials",
    detail: "Docket documents not yet read.",
    url: "https://www.regulations.gov/docket/EPA-HQ-OLEM-2025-0391",
    reviewed: "Not yet reviewed",
    status: "unassessed",
    solution: "Not assessed. To be read in a later deep dive.",
    strengths: {},
  },
  // ---------------------------------------------------------------- Webinars
  {
    category: "e-Manifest quarterly webinars",
    title: "Oct 29, 2025 webinar: FY2026/27 user fees and Dec 1, 2025 release",
    detail: "EPA. Fees $25 image, $7 data plus image, $5 electronic or hybrid; electronic Exception, Discrepancy and Unmanifested Waste reports; PATCH API removed.",
    url: "https://www.epa.gov/e-manifest/monthly-webinars-about-hazardous-waste-electronic-manifest-e-manifest",
    reviewed: "Full",
    status: "partial",
    solution: "No ManifestMate user pays these fees and the FAQ explains who does. The electronic Exception Report is not supported beyond overdue alerts (production) and reminder emails (dev only); filing in e-Manifest is not built.",
    strengths: {
      customer: "Fee amounts and who pays are in the FAQ.",
      development: "No dependence on the removed PATCH services.",
    },
  },
  {
    category: "e-Manifest quarterly webinars",
    title: "Mar 25, 2026 webinar: Paper Sunset Rule",
    detail: "EPA. Key dates, intent, scope, affected parties, hybrid.",
    url: "https://www.epa.gov/e-manifest/monthly-webinars-about-hazardous-waste-electronic-manifest-e-manifest",
    reviewed: "Full",
    status: "partial",
    solution: "See the Sunset Rule row: electronic path covered; no hybrid, broker statement or Broker ID prompt.",
    strengths: {
      solutions: "Electronic-first product is unaffected by the sunset's paper end date.",
    },
  },
  {
    category: "e-Manifest quarterly webinars",
    title: "Jun 17, 2026 webinar: Sunset reminder, Manifest Workflow Widget, vehicle weight limits",
    detail: "EPA. Interstate 80,000 lb and 286,000 lb railcar limits raised for quantity data quality.",
    url: "https://www.epa.gov/e-manifest/monthly-webinars-about-hazardous-waste-electronic-manifest-e-manifest",
    reviewed: "Full",
    status: "partial",
    solution:
      "Quantities must now be whole numbers within EPA's range (fixed 2026-11-04 on production and dev). No plausibility check against vehicle weight limits. EPA's workflow widgets overlap University content, so linking is better than duplicating.",
    strengths: {
      development: "Quantity validation runs before submit with a plain-language message.",
    },
  },
  {
    category: "e-Manifest quarterly webinars",
    title: "Sept 23, 2026 webinar: Manifest Data Upload Tool",
    detail: "EPA. Excel in, electronic manifests out, inside RCRAInfo, aimed at users who want to try electronic manifesting.",
    url: "https://www.epa.gov/e-manifest/monthly-webinars-about-hazardous-waste-electronic-manifest-e-manifest",
    reviewed: "Full",
    status: "covered",
    solution: "A direct competitor to ManifestMate's CSV import and wizard for small generators.",
    strengths: {
      solutions: "ManifestMate adds Quick-Sign delegation, broker workflows, profile and lab-pack reuse, labels, and not needing RCRAInfo access for the preparer.",
      customer: "Guided onboarding and a knowledge base that EPA's tool does not provide.",
    },
  },
];
