# Delegated Quick-Sign Access — design sketch

**Status: NOT STARTED.** Brainstormed 2026-07-25, sketched for future
reference — same spirit as `ldr schema.md` at the repo root. Nothing here
has been built or tested.

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
