# EPA Registration Onboarding Wizard — design sketch

**Status: design only, nothing built yet.** Sketched 2026-07-26 following a
conversation about the real gap in ManifestMate's onboarding: there's
currently no guided path for a brand-new user who doesn't yet have a
RCRAInfo account, an EPA ID number, or API credentials — they just hit a
wall trying to enter credentials MM has no way to help them obtain.

## The idea

A gated (requires a free MM account, not payment) onboarding flow that
turns EPA's genuinely confusing multi-agency registration process into an
ordered, resumable, 5-step checklist inside the app — ending with MM
validating the user's freshly-generated API credentials and dropping them
straight into manifest creation.

## Why this can't be a full-automation feature (recap of the research)

Confirmed via EPA's own registration docs and RCRAInfo user guides — none
of these steps have a public API a third party could call on the user's
behalf, and that's by design, not an oversight:

1. **RCRAInfo/CDX account creation** — a normal online signup.
2. **EPA ID number request** — via EPA's `myRCRAid` tool, submits Form
   8700-12 (Notification of Regulated Waste Activity) to the relevant state
   agency or EPA region for approval. Turnaround varies by state; not
   instant.
3. **Site Manager/Certifier permission + Electronic Signature Agreement** —
   requires identity proofing, either instantly online via a third-party
   verifier (LexisNexis) or via a slower notarized paper form. This is
   CROMERR's identity-proofing requirement — the same reason
   [[delegate-quick-sign-design]] proxies credentials rather than trying to
   impersonate a signer.
4. **API ID/Key generation** — done by the user themselves inside RCRAInfo's
   own UI (Tools → API), visible only once they're a Site Manager. No API
   endpoint exists for a third party to do this step.

MM's role is guidance and state-tracking around these steps, not replacing
them. This mirrors [[project-manifestmate-create-vs-sign-permission]]:
onboarding friction is real and load-bearing for the business, but the
identity/signature chain is EPA's to own, not MM's to bypass.

## On "snipe-proofing" this — why the answer isn't hiding the content

The step-by-step instructions here are already public — EPA's own site,
state-agency PDFs, and at least one competitor's blog all cover this same
process for free, as a lead-gen play. There's no proprietary information to
protect, and gating the *instructions themselves* would mostly hurt organic
search traffic without stopping anyone (a paywalled or logged-in-only guide
just pushes people to the free version elsewhere). What genuinely can't be
copied is the **stateful, personalized, validated experience** — a static
guide can't remember which step a user is on, can't hold their EPA ID
number for later reuse, and can't test their API key against RCRAInfo. That
only exists inside MM, so requiring a free account to use the *tracked*
version of this wizard (while a plain-language explainer stays public for
marketing/SEO, e.g. folded into `docs/FAQ.md`) is the honest value-capture
point — not restricting the underlying facts.

## Data model

New table, e.g. `epa_registration_progress` — one row per user:

```sql
create table public.epa_registration_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cdx_account_done_at timestamptz,
  epa_id_requested_at timestamptz,
  epa_id_number text,              -- once they have it; seeds their generator profile
  esa_completed_at timestamptz,
  api_credentials_entered_at timestamptz,
  api_credentials_validated_at timestamptz,
  updated_at timestamptz not null default now()
);
```

RLS: user can only read/write their own row. Steps 1–3 are self-attested
(a checkbox — MM has no way to verify externally); step 5 is the only step
MM actually confirms, by making a lightweight authenticated RCRAInfo call
with the pasted-in credentials.

## The progress page

Matches the visual idea from the conversation: 5 boxes in a row (or a
vertical stepper on narrow screens), each representing one step, plus an
overall progress indicator summarizing completion at a glance.

**Per-step box:**
- Title + one-line plain-English description of what this step actually is
- Status light: gray (not started) → amber (in progress) → green (done) →
  red (failed, step 5 only — a bad API key)
- Expand/collapse to show: a short explainer, a direct link to the right
  EPA tool for that step, and (steps 2 and 4 only) an input field —
  EPA ID number for step 2, API ID + Key for step 4
- Step 4's expanded state has a "Validate" button that fires the real check

**Overall indicator:** a progress bar or "N of 5 complete" header above the
boxes — this is the part worth making visually catchy, since it's the
at-a-glance payoff for a user who might be checking back days later after
waiting on state approval of their EPA ID.

**On full completion:** step 5 validating successfully replaces the whole
wizard with a "you're set up" state and a CTA straight into
"create your first manifest," pre-filled with the EPA ID number captured
in step 2.

## Resumability

This is the part a static guide fundamentally can't offer, and the actual
reason to gate it behind an account: step 2 (state approval of the EPA ID)
can take days. A user should be able to close the tab and come back to
find their progress exactly as they left it, not start over or lose their
place in a linear guide.

## Follow-up build, 2026-07-26

Two of the open questions below got resolved same day, after the user
live-tested v1 end-to-end (happy path and a deliberate bad-credentials
failure path, both worked):

- **Question 2 (EPA ID auto-populates the generator form): done.** New
  `getSiteDetailsAction()` (`manifestActions.ts`) plus a `useEffect` in
  `manifests/new/page.tsx` that reads the onboarding wizard's saved
  `epaIdNumber`, looks it up via `getSiteDetails()`, and fills the
  generator fields through the existing `fillHandlerFromSite` helper —
  `SiteSearchResultItem` and `SiteDetails` are the same type, so no
  adapter was needed. Guarded the same way the emergency-phone prefill
  already was: only overwrites generator fields still sitting at the
  hardcoded dev default (`DEFAULT_SITE`), so a manual edit never gets
  clobbered, and silently no-ops if the lookup fails (e.g. not yet
  authorized for that site) rather than surfacing an error on page load.
- **Question 3 (returning fully-set-up user): resolved as "show a
  collapsed all-done version," not "skip the wizard entirely."** Fixed a
  real bug this exposed: `firstIncompleteStep()` returned step 5 even when
  everything was already validated, so a fully-set-up returning user saw
  the credentials form pop open again for no reason. Now returns `null`
  once step 5's real validation timestamp is set, so nothing auto-expands
  and the completion banner is what they actually see.

Questions 1 and 4 are still open — neither came up during live-testing, so
no reason to resolve them speculatively.

## Open questions for whenever this gets built

1. Should the self-attested steps (1–3) have any lightweight nudge/reminder
   (e.g. "still waiting on step 2? here's who to contact") or stay purely
   passive checkboxes?
2. Copy/tone: how strongly should MM steer users toward the instant online
   identity-proofing path (LexisNexis) over the slower notarized-paper
   option in step 3? A strong recommendation seems clearly right, but worth
   deciding deliberately rather than defaulting to neutral EPA-speak.
