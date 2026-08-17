# Delegated Quick-Sign Access — design sketch

**Status: V1 BUILT 2026-07-26, live-test unconfirmed.** Brainstormed
2026-07-25, built out autonomously 2026-07-26 while the resolution to the
open questions below was made by best judgment rather than a live
conversation — review the "v1 decisions" section before relying on this in
front of a real customer, and live-test the whole accept → sign flow with
two real accounts before trusting it. Migration
`supabase/migrations/20260727_create_quick_sign_delegates.sql` still needs
to be applied (Supabase Dashboard SQL Editor, same manual process as every
other migration in this project) before any of this works.

## v1 decisions (answers to the open questions below)

1. **Delegate's manifest visibility**: a delegated lookup or sign writes its
   resulting manifest/document records against the *owner's* account
   (`effectiveUserId` in `getRcrainfoClientForAction`,
   `src/services/manifestService.ts`), so they show up on the owner's
   dashboard — not a separate delegate-only view. A delegate isn't given
   their own dashboard of "manifests I've signed" in v1 — they find what
   needs signing via Look Up Manifest (by MTN), not the Dashboard, which
   stays scoped to literal `user_id` ownership.
2. **Scoping granularity**: role-type only (`allowed_site_types`), not
   specific EPA site IDs, as originally sketched. Good enough for an owner
   with one site; revisit if/when multi-site owners want this.
3. **"On behalf of" UI**: the sign confirmation dialog
   (`SignManifestPanel.tsx`) shows a banner naming the owner whenever the
   signer is an active delegate, before they can confirm.
4. **Invite delivery**: no transactional email is wired up in this project
   (checked — nothing beyond Supabase Auth's own account-confirmation
   emails). Standing up a new email provider wasn't a call to make
   unilaterally while unsupervised, so v1 invites are a shareable link
   (`/delegate/accept?token=...`) the owner copies and sends themselves,
   not an automatic email. Easy to upgrade later without changing the data
   model.
5. **One delegation at a time**: a delegate account can hold at most one
   active delegation (enforced by a partial unique index), to avoid the
   unresolved question of which owner's data a sign action belongs to if a
   delegate worked for multiple owners at once.
6. **Default role scope on invite**: the Settings UI defaults new invites to
   Transporter-only, with Generator requiring an explicit, visually flagged
   opt-in — directly reflecting this project's own "whoever signs as
   generator is the one going to jail" framing from the conversation that
   led to the sign-confirmation clickwrap in the first place.
7. **Audit trail**: reuses `signature_consents` (already records the real
   caller in `user_id`, independent of whose credentials get used) rather
   than the separate `sign_events` table originally sketched below — that
   table didn't exist yet when this doc was first written, but does now
   (built 2026-07-26 for the clickwrap audit trail). Added one column,
   `signed_for_owner_user_id`, to make the "acting on behalf of" link
   explicit.

## Live-test round 1 findings (2026-07-26)

Real two-account testing (owner: notoreusbfg@gmail.com, delegate invited at
matt.gemmell@outlook.com) surfaced a real gap the design/typecheck pass
missed: **a delegate couldn't do anything at all**, because only
`signManifestAction` had been made delegation-aware — manifest *lookup*
(how a delegate would find something to sign in the first place) still
demanded the delegate's own EPA credentials, which they by design don't
have. Fixed:

- `getRcrainfoClientForSigner` renamed to `getRcrainfoClientForAction` and
  widened to take an optional `siteType` (omitted = no role check) so both
  lookup and signing can share one delegation-aware resolver.
  `fetchManifestForCurrentUser` (backs both the lookup form and the
  post-sign refresh) now goes through it, recording the result under the
  *owner's* account either way — consistent with how a delegated sign
  already worked, so lookup and sign always agree on whose data this is.
- New migration `2026072801_add_delegate_read_access.sql`: the first
  migration only granted delegates INSERT/UPDATE on
  manifests/manifest_documents/storage.objects, not SELECT — which
  silently breaks `recordManifestLocally`'s `.upsert().select()` (Postgres
  RLS needs a SELECT policy to return the affected row) and blocks
  `listStoredDocumentsAction` outright. Needs to be applied after
  `20260727_create_quick_sign_delegates.sql`.
- Confirmed manifest *creation* staying owner-only (not delegable) was the
  right call, not a gap — asked directly during live-testing, and it
  matches the "Quick-Sign" framing: delegates act on manifests that
  already exist, they don't originate new EPA filings.
- Also confirmed **the "email/text credentials to the delegate" concern
  this feature exists to solve was never actually a risk in the built
  code** — a delegate's browser never receives the owner's API
  credentials; they're decrypted only server-side inside
  `getRcrainfoClientForAction`. The "you need API credentials" error the
  delegate hit was purely the lookup gap above, not a design flaw.
- Settings UI: the invite form's role checkboxes now start fully
  unchecked (previously defaulted Transporter checked) and are ordered
  Generator/Transporter/Tsdf to match the manifest's own handler order,
  per direct user feedback.

## What's genuinely unverified

Nothing in this feature has been exercised against real Supabase or
RCRAInfo state yet — it's typechecked and route-smoke-tested (pages render,
no server errors) only. Before showing this to a real user: apply the
migration, create a real invite, accept it with a second real account, and
confirm an actual delegated `signManifest()` call succeeds and lands in
`signature_consents` with `signed_for_owner_user_id` set correctly.

## The idea

A ManifestMate user who holds real RCRAInfo API credentials (a "Site
Manager," in RCRAInfo's own terminology) can invite other people — by
email — to trigger Quick Sign actions using those credentials, without the
invitee ever registering their own RCRAInfo account or API key. Turns
"you need your own EPA registration" (a real onboarding barrier — EPA
registration/credentialing is confirmed not automatable by any third party)
into "you just need an email invite from your Site Manager."

## Why this is legitimate, not just a workaround

Confirmed via EPA's own manifest form instructions (Item 15 note): an
employee may sign "on behalf of" their employer/principal without being a
personally-registered signer — this is explicitly contemplated for the
paper signature block. This feature is the electronic-era version of that
same "on behalf of" pattern, not a novel workaround.

## The one thing this can't fix — and must be designed around, not ignored

**RCRAInfo's recorded legal signer is whoever's account the API
credentials belong to — not whoever triggered the API call.** Confirmed
live earlier this project: `printedSignatureName` is cosmetic; the actual
signer identity comes from the credentials themselves. A delegate signing
via the owner's credentials will show up on EPA's own record as the
*owner* (e.g. the Site Manager), never the delegate (e.g. the driver).
ManifestMate cannot change this — it's how RCRAInfo's API works. What
ManifestMate *can* do is keep its own internal audit trail of which real
ManifestMate user triggered each sign action, independent of what EPA
sees. **This must be designed in from the start, not bolted on later** —
it's the only real accountability mechanism this feature has.

## Data model

New table, e.g. `quick_sign_delegates`:

```sql
create table public.quick_sign_delegates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  delegate_user_id uuid references auth.users(id) on delete cascade, -- null until invite accepted
  invited_email text not null,
  -- Extra layer beyond whatever RCRAInfo itself restricts for the
  -- underlying credentials — e.g. a driver might be scoped to
  -- Transporter-only, never Generator/Tsdf, even though the owner's
  -- credentials could sign as any role.
  allowed_site_types text[], -- null = no extra restriction beyond RCRAInfo's own
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);
```

RLS: owner can manage their own delegation rows; a delegate can see rows
where they're `delegate_user_id`, read-only.

## Credential resolution at sign time

Today: `getRcrainfoClientForUser(supabase, userId)` looks up `userId`'s
own row in `user_credentials`. This needs to become: look up the user's
own credentials first; if none, check `quick_sign_delegates` for an
active (accepted, not revoked) delegation, and if `allowed_site_types`
permits the requested `siteType`, use the *owner's* credentials instead.
Reject clearly (not silently) if a delegate tries to sign a role outside
their `allowed_site_types`.

## Every sign action logs the real actor, separately from EPA's record

Whatever local audit mechanism exists (today: `recordManifestLocally` /
the `manifests` mirror table) needs a companion log — e.g. a
`sign_events` table recording `{manifest_id, acting_user_id (the real
person, delegate or owner), site_type, transporter_order, signed_at}` —
independent of the EPA-recorded signer identity. This is the only place
"which of my employees actually signed this" lives.

## Invite flow

Doesn't need Supabase's admin-level invite API (which needs a
service-role key not currently configured in this environment) — a
simple token-based flow works: owner enters an email, a pending
`quick_sign_delegates` row is created (`delegate_user_id` null,
`invited_email` set), an email goes out with a signup/accept link. On
that link, if the invitee doesn't have a ManifestMate account, they
create one; either way, the delegation row gets `delegate_user_id` +
`accepted_at` filled in on acceptance.

## Revocation

Owner sets `revoked_at` on the delegation row. Credential resolution at
sign time must check this every time (not cache "is this a valid
delegate" beyond a single request) — a revoked driver should lose sign
access immediately, not eventually.

## Open questions for whenever this gets built

1. Should a delegate see the owner's full manifest list, or only
   manifests they're actively part of? (Affects whether this reuses
   `listManifestsForUser` as-is or needs a delegate-scoped variant.)
2. Does `allowed_site_types` need to go further — e.g. scoped to specific
   EPA site IDs, not just role types, for owners who manage multiple
   sites?
3. UI: where does a delegate see "you're signing on behalf of X" so
   it's clear whose authority they're acting under, given EPA's own
   record won't show their name at all?
