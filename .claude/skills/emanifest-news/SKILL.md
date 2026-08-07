---
name: emanifest-news
description: Use when the user asks for news, updates, or recent changes related to EPA's e-Manifest program, RCRAInfo, or hazardous waste manifest regulations — e.g. "any e-manifest news," "did EPA change anything," "what's new with RCRAInfo." Searches primary/official sources rather than generic web results, and sorts findings by what's actionable for ManifestMate vs. just informational.
---

# EPA e-Manifest / RCRAInfo news check

ManifestMate is a thin UI + orchestration layer over EPA's live RCRAInfo
e-Manifest REST API (see `CLAUDE.md`) — a regulatory or system change on
EPA's side can affect this app directly, unlike most news-monitoring asks.
Search real sources, don't just summarize whatever a generic query surfaces.

## Where to look, in order of reliability

1. **EPA's e-Manifest program page** (`epa.gov/e-manifest`) — official program
   news, rule status, fee schedule.
2. **Federal Register** (`federalregister.gov`) — search "e-Manifest" or
   "hazardous waste manifest" for proposed/final rules. This is the
   authoritative source for anything rule-related; don't trust a rule's
   existence or effective date from a secondary source without confirming
   here or in eCFR.
3. **eCFR** (`ecfr.gov`) — current regulatory text, for confirming whether a
   reported change has actually taken effect yet vs. still being proposed.
4. **`github.com/USEPA/e-manifest`** — EPA's own reference client repo (see
   `reference_epa_emanifest_github_docs` project memory). Check its commit
   history/releases for API-level changes (new endpoints, schema changes,
   deprecations) — this catches technical changes Federal Register notices
   won't mention at all, since not every API change is a rulemaking.
5. **RCRAInfo/CDX system status** — search for any posted outage or
   maintenance-window notices. Worth surfacing even though it's not
   "news" in the regulatory sense: `RCRAINFO_ENV` in this project points at
   **preprod**, and prod/preprod maintenance windows aren't always announced
   the same way, so this is genuinely useful operational info, not noise.

Trade/industry publications (Waste360, Environmental Protection, etc.) can
surface something worth digging into, but treat them as a lead to verify
against sources 1-4, not as citable fact on their own — same standard as
[[fact-check-marketing-copy]].

## Sorting findings — don't just dump a list

Separate the report into:
- **Actionable** — something that could require a code/data change:
  - RCRAInfo API changes → cross-check against `src/lib/rcrainfo/client.ts`,
    `src/lib/rcrainfo/MANIFEST_SCHEMA.md`, and the `emanifest-js`/`emanifest-py`
    reference clients in the GitHub repo above.
  - Fee schedule or program-name changes → relevant to marketing/onboarding
    copy accuracy, see [[fact-check-marketing-copy]].
  - New or amended DOT/EPA waste or hazmat codes → check against
    `src/lib/hazmat/`, `src/lib/stateWasteCodes.ts`,
    `docs/waste-codes-reference.json`, `docs/un-waste-codes.json` (large
    generated lookup tables — flag for regeneration, don't hand-edit).
  - A finalized rule (e.g. anything in the "e-Manifest Third Rule" family
    already referenced elsewhere in this project) reaching an actual
    effective date.
- **Content opportunity** — genuinely interesting regulatory/educational
  material that doesn't require code changes but fits Haz Waste University's
  "deeper dive" framing. Per the standing practice in
  [[feedback_haz_waste_university_ongoing]], note these as candidate topics
  rather than letting them go unused just because this was a news-check, not
  a content-writing task.
- **FYI only** — confirmed-but-not-actionable context (e.g. a maintenance
  window that already passed, a proposed rule with no effective date yet).

## Report format

Date the check. For each finding, cite the actual source (URL or repo
path/commit), not just a description — the same discipline
`reference_epa_emanifest_github_docs` already established for API research.
If nothing new turns up, say that plainly rather than padding the report
with old/already-known information restated as if new.

## Notification — guaranteed, not discretionary

**If the "Actionable" section has any entries, send a push notification
before finishing** — don't leave this to judgment call by call. This is
the whole point of running unattended: the user shouldn't have to
remember to go check `docs/emanifest-news-log.md`. Keep the notification
to one line, lead with the finding itself (e.g. "EPA proposed Paper
Manifest Sunset Rule — would require e-Manifest registration for
transporters/PCB/VSQGs"), not a generic "new report available." No
notification needed for Content-opportunity-only or FYI-only runs, or
when nothing new turned up — that's not something worth interrupting for.

## State tracking (for the scheduled check)

This skill also runs on a **daily cloud routine** that gates itself to
roughly once every 7 days — see the routine at
`https://claude.ai/code/routines` (named `emanifest-news-weekly-check`).
Its every-run logic:

1. Read `.claude/skills/emanifest-news/.last-run` (a single UTC ISO8601
   timestamp). Missing file = treat as never run.
2. If it's been **less than 7 days**, stop — no search, no commit, no log
   entry. This is the only gate; nothing else in this skill is
   schedule-aware.
3. If it's been **7+ days** (or the file is missing), do the actual check
   per the rest of this SKILL.md, then:
   - Prepend a dated entry to `docs/emanifest-news-log.md` (same
     newest-on-top convention as `docs/NOTES.md`).
   - Overwrite `.claude/skills/emanifest-news/.last-run` with the current
     UTC timestamp (`date -u +%Y-%m-%dT%H:%M:%SZ`).
   - Commit both together (`git add docs/emanifest-news-log.md
     .claude/skills/emanifest-news/.last-run`) with message
     `emanifest-news check — <date>: <one-line summary>`, and push to
     `main`.

**This is why an ad-hoc, user-triggered run of this skill (asked mid-week,
not from the schedule) must follow the same update-and-push steps above
every time it actually performs a real search** — regardless of what the
`.last-run` gate would have said — since that's the only mechanism that
resets the 7-day clock for the next scheduled run. An ad-hoc ask always
does the real search (the 7-day gate is for the automatic routine deciding
whether to bother, not for a direct question), but it must still update and
push the state file afterward, or the scheduled routine won't know the
clock reset and will fire again too soon.

If a local session doesn't have push access configured (or the user hasn't
approved a `git push` yet), still write the local files and tell the user
explicitly that the state wasn't pushed — an un-pushed timestamp update is
invisible to the cloud routine and won't reset anything.
