# EPA e-Manifest / RCRAInfo news check log

Dated log of `emanifest-news` skill runs (scheduled weekly cloud routine or
ad-hoc). Newest entry on top. See `.claude/skills/emanifest-news/SKILL.md`
for what this checks and how the schedule/reset mechanism works.

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
