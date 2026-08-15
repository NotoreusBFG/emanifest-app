# EPA e-Manifest / RCRAInfo news check log

Dated log of `emanifest-news` skill runs (scheduled weekly cloud routine or
ad-hoc). Newest entry on top. See `.claude/skills/emanifest-news/SKILL.md`
for what this checks and how the schedule/reset mechanism works.

---

## 2026-08-15

Scheduled weekly check. No new actionable items since the 2026-08-07 run —
the Paper Manifest Sunset Rule is still proposed, and the reference client
has no breaking changes to report.

### Actionable

None this week.

- **Paper Manifest Sunset Rule** — unchanged since 2026-08-07: still
  proposed, comment period (closed May 4, 2026) is over, no final rule or
  effective date yet. Confirmed still absent from eCFR. See
  [Federal Register notice](https://www.federalregister.gov/documents/2026/03/05/2026-04366/paper-manifest-sunset-rule-modification-of-the-hazardous-waste-manifest-regulations).
  Continue watching for a final-rule publication.
- **`github.com/USEPA/e-manifest` reference client** — still at v5.0.0
  (Nov 2025). Commits since then (checked via commit history) are docs/
  dependency-file changes only (`emanifest.json`, `README.md`,
  `pyproject.toml`/`requirements.txt`) — no further PATCH/endpoint removals
  or schema changes to cross-check against `src/lib/rcrainfo/client.ts`.

### Content opportunity

- **EPA OIG evaluation of the e-Manifest system** — Report No. 26-E-0047,
  published August 11, 2026:
  [Evaluation of the EPA's e-Manifest System](https://www.epa.gov/office-inspector-general/notification-evaluation-epas-e-manifest-system)
  ([oversight.gov listing](https://www.oversight.gov/reports/evaluation-epas-e-manifest-system)).
  Key finding: fewer than 0.5% of manifests filed are electronic despite the
  program existing since 2018, and manual transcription from paper into the
  system remains a data-entry-error risk. Strong Haz Waste University angle
  — "why e-Manifest adoption is still so low, and how the Paper Manifest
  Sunset Rule is meant to fix it" — ties directly into the still-pending
  Sunset Rule above. No code/data implications; this is about EPA-wide
  adoption, not an API or schema change.
- **New "S-series" Management Method Codes replacing H141** — effective
  January 1, 2027, already active in RCRAInfo now, per
  [IHMM briefing](https://ihmm.org/briefing-paper-for-ihmm-certificants-epa-retirement-of-management-method-code-h141-and-introduction-of-new-s-codes-for-hazardous-waste-reporting/).
  Checked: these are Biennial Report management-method codes, not manifest
  waste codes — grepped `src/` for `H141`/`S-code`/`managementMethod`,
  no matches, confirmed not used anywhere in this app's manifest schema or
  `src/lib/hazmat/` lookup tables. Not actionable for ManifestMate, but
  flagging since a generator user could plausibly ask about it.
- EPA has signaled plans to propose new universal waste rules covering
  end-of-life solar panels and lithium batteries (no docket/NPRM published
  yet as of this check) — too early for an article, but a candidate topic
  to revisit once a proposed rule actually publishes.

### FYI only

- **EPAAR update — contractor manifest-signing authority** (April 8, 2026):
  [Update to EPAAR Text of Provisions and Clauses, Signing of Uniform
  Hazardous Wastes Manifests](https://www.federalregister.gov/documents/2026/04/08/2026-06775/update-to-epaar-text-of-provisions-and-clauses-signing-of-uniform-hazardous-wastes-manifests).
  Lets EPA contractors sign Form 8700-22 "on behalf of" EPA at Superfund/
  non-Superfund cleanup sites without creating a generator relationship or
  agency relationship. Comment period closed June 8, 2026. Not applicable
  to ManifestMate's user base (generators/transporters/TSDFs, not EPA
  procurement contractors).
- **FY2026–2027 e-Manifest user fees** — already in effect since October 1,
  2025 (predates this check's window), unchanged. See
  [40 CFR Part 264 Subpart FF](https://www.ecfr.gov/current/title-40/chapter-I/subchapter-I/part-264/subpart-FF).
  No marketing/onboarding copy impact this week.
- **RCRAInfo/CDX system status** — direct fetch of
  [RCRAInfo Status](https://rcrainfostatus.statuspage.io/) was blocked by
  this environment's network egress proxy again this run (same as
  2026-08-07); WebSearch-indexed snapshots show 100% uptime through at
  least July 2026 with no incidents, but that's not a live read. Worth a
  manual spot-check when a human has unrestricted access.
- Forty-Ninth Update of the Federal Agency Hazardous Waste Compliance
  Docket (April 23, 2026) — lists/delists specific federal facility sites
  under RCRA §120(c); not related to e-Manifest program mechanics, no
  relevance to this app.

---

## 2026-08-07

First run of this check (no prior log entry / `.last-run` existed).

### Actionable

- **EPA's "Paper Manifest Sunset Rule" (proposed, not yet final)** — published
  in the Federal Register March 5, 2026: [Paper Manifest Sunset Rule;
  Modification of the Hazardous Waste Manifest Regulations](https://www.federalregister.gov/documents/2026/03/05/2026-04366/paper-manifest-sunset-rule-modification-of-the-hazardous-waste-manifest-regulations)
  (docket `EPA-HQ-OLEM-2025-3456`). Would eliminate paper manifests 24 months
  after a final rule publishes, and — notably for this app — would newly
  **mandate e-Manifest registration** for hazardous-waste transporters, PCB
  waste transporters, and VSQGs managing episodic events, categories not
  previously required to register. Comment period closed May 4, 2026; per
  [Lion Technology's March 2026 recap](https://www.lion.com/lion-news/march-2026/epa-proposes-sunset-date-for-paper-hazardous-waste-manifests)
  and other secondary sources, EPA is still reviewing comments — **not yet
  finalized**, no effective date yet, so nothing to change in code today.
  Worth re-checking specifically for a final-rule publication, since it would
  directly touch this app's registration assumptions and possibly
  `src/lib/rcrainfo/client.ts` / the Quick-Sign delegation model's premise
  that some parties don't need their own RCRAInfo credentials. eCFR does not
  yet reflect any change (rule is still proposed).
- **`github.com/USEPA/e-manifest` reference client — v5.0.0 (bumped ~Nov
  2025, still current as of this check)**: removed functions that called
  deprecated PATCH services, per repo commit history. Worth a quick check
  that `src/lib/rcrainfo/client.ts` isn't relying on any PATCH-based
  save/update calls the reference client has since dropped — no direct
  evidence found of an equivalent removal on EPA's live API side, but this
  is the kind of change Federal Register notices wouldn't mention. No
  formal GitHub Releases exist for the repo (page shows "There aren't any
  releases here" as of this check), so version history has to be read from
  commits, not releases.

### Content opportunity

- The Paper Manifest Sunset Rule itself (above) is a strong Haz Waste
  University candidate once finalized — "why EPA is retiring paper
  manifests and what changes for generators/transporters" — but per the
  skill's fact-check practice, hold off writing anything until there's a
  final rule with a real effective date; several secondary sources
  (Certify Consulting, Amergy Disposal, Wastebits) are already publishing
  explainer content off the *proposed* rule that overstates certainty about
  dates.
- EPA's e-Manifest Advisory Board [request for public input on charge
  questions](https://www.federalregister.gov/documents/2026/02/06/2026-02343/hazardous-waste-electronic-manifest-program-e-manifest-request-for-public-input-on-charge-questions)
  and [request for nominations](https://www.federalregister.gov/documents/2026/02/06/2026-02342/the-hazardous-waste-electronic-manifest-system-e-manifest-advisory-board-request-for-nominations)
  (both Feb 6, 2026, comment deadline March 9, 2026 — already closed) could
  make a short "how e-Manifest system governance actually works" piece, low
  priority.

### FYI only

- RCRAInfo / CDX system status: both reporting 100% uptime over the trailing
  90 days per [RCRAInfo Status](https://rcrainfostatus.statuspage.io/) —
  no outages to report. One already-past maintenance note: Pay.gov (used
  for e-Manifest invoice fee payments) had a ~12-hour scheduled maintenance
  window June 20, 2026, per EPA notice — already elapsed, no action needed.
- A separate proposed rule amending RCRA's definition of hazardous waste
  (corrective-action related, unrelated to e-Manifest) was **withdrawn** by
  EPA May 8, 2026 — not applicable to this app either way.
- Direct fetches of `epa.gov` and `federalregister.gov` were blocked by this
  environment's network egress proxy; findings above are via WebSearch
  result summaries citing those primary-source URLs, not a direct fetch of
  the documents. Worth a manual spot-check of the docket link above when a
  human has unrestricted access.

---
