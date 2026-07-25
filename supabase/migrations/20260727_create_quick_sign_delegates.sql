-- Delegated Quick-Sign access. Design: docs/delegate-quick-sign-design.md.
-- A ManifestMate user with real RCRAInfo API credentials (the "owner") can
-- invite another ManifestMate user (the "delegate") to trigger sign actions
-- using the owner's credentials, without the delegate ever registering their
-- own RCRAInfo account. RCRAInfo's own record will always show the owner as
-- signer (confirmed live: the API only knows about credentials, not who's
-- actually driving the request) -- accountability for "which real person
-- triggered this" lives entirely in this app's own audit trail
-- (signature_consents.user_id, already the real caller, independent of whose
-- credentials get used to sign -- see 20260726_create_signature_consents.sql).
--
-- v1 scoping decisions (documented here since the design doc left these
-- open): a delegate may hold at most one active delegation at a time
-- (enforced below), scoping is by site type only (Generator/Transporter/
-- Tsdf), not by specific EPA site ID, and invites are accepted via a
-- shareable token link the owner copies and sends themselves -- no
-- transactional email provider is configured in this project, and standing
-- one up wasn't a call to make unilaterally.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder.

create table if not exists public.quick_sign_delegates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  -- Denormalized at invite time so the accept page and delegate-facing UI
  -- can show "invited by X" without needing to read auth.users, which RLS
  -- doesn't expose to normal clients.
  owner_email text not null,
  delegate_user_id uuid references auth.users(id) on delete cascade,
  invited_email text not null,
  invite_token uuid not null default gen_random_uuid(),
  -- null = no extra restriction beyond whatever RCRAInfo itself allows for
  -- the owner's credentials. Non-null = delegate can only sign these roles.
  allowed_site_types text[],
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists quick_sign_delegates_invite_token_idx
  on public.quick_sign_delegates(invite_token);

-- At most one active (accepted, not revoked) delegation per delegate account
-- -- v1 deliberately doesn't support a delegate acting for multiple owners,
-- to avoid the ambiguity of which owner's manifests a sign action belongs to.
create unique index if not exists quick_sign_delegates_one_active_delegate
  on public.quick_sign_delegates(delegate_user_id)
  where accepted_at is not null and revoked_at is null;

-- Avoid piling up duplicate pending invites to the same email from the same
-- owner (harmless, just noise) -- doesn't block re-inviting after a revoke.
create unique index if not exists quick_sign_delegates_one_pending_invite
  on public.quick_sign_delegates(owner_user_id, lower(invited_email))
  where accepted_at is null and revoked_at is null;

alter table public.quick_sign_delegates enable row level security;

drop policy if exists "Owners can view their own delegates" on public.quick_sign_delegates;
create policy "Owners can view their own delegates"
  on public.quick_sign_delegates for select
  using (auth.uid() = owner_user_id);

drop policy if exists "Owners can create delegate invites" on public.quick_sign_delegates;
create policy "Owners can create delegate invites"
  on public.quick_sign_delegates for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "Owners can update their own delegates" on public.quick_sign_delegates;
create policy "Owners can update their own delegates"
  on public.quick_sign_delegates for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "Delegates can view delegations naming them" on public.quick_sign_delegates;
create policy "Delegates can view delegations naming them"
  on public.quick_sign_delegates for select
  using (auth.uid() = delegate_user_id);

-- Lets a not-yet-accepted invitee load the accept page (matched by their
-- logged-in email, before delegate_user_id is filled in).
drop policy if exists "Invitees can view their own pending invite" on public.quick_sign_delegates;
create policy "Invitees can view their own pending invite"
  on public.quick_sign_delegates for select
  using (
    delegate_user_id is null
    and accepted_at is null
    and lower(invited_email) = lower(auth.jwt() ->> 'email')
  );

-- Lets an invitee accept by setting delegate_user_id/accepted_at on
-- themselves -- the accept action only ever sends those two columns, but RLS
-- can't fully pin that down at the row level, so this is the same trust
-- level already relied on elsewhere in this app (anon key + RLS as the whole
-- boundary).
drop policy if exists "Invitees can accept their own pending invite" on public.quick_sign_delegates;
create policy "Invitees can accept their own pending invite"
  on public.quick_sign_delegates for update
  using (
    delegate_user_id is null
    and accepted_at is null
    and lower(invited_email) = lower(auth.jwt() ->> 'email')
  )
  with check (delegate_user_id = auth.uid());

-- Lets a delegate see the owner's stored EPA credentials for exactly as long
-- as their delegation is active -- additive to (not a replacement for) the
-- "own row only" policy in 20260723_create_user_credentials.sql, since
-- Postgres OR's multiple permissive policies for the same command together.
drop policy if exists "Delegates can view active owner credentials" on public.user_credentials;
create policy "Delegates can view active owner credentials"
  on public.user_credentials for select
  using (
    exists (
      select 1 from public.quick_sign_delegates d
      where d.owner_user_id = user_credentials.user_id
        and d.delegate_user_id = auth.uid()
        and d.accepted_at is not null
        and d.revoked_at is null
    )
  );

-- Helper used by the policies below: true when the calling user is an
-- active (accepted, not revoked) Quick-Sign delegate of `owner`. Plain SQL
-- function (not security definer) -- it runs as the calling role, same as
-- the RLS policy it's used inside, and relies on the delegate's own "view
-- delegations naming them" select policy above already permitting this read.
create or replace function public.is_active_delegate_for(owner uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.quick_sign_delegates d
    where d.owner_user_id = owner
      and d.delegate_user_id = auth.uid()
      and d.accepted_at is not null
      and d.revoked_at is null
  );
$$;

-- A delegated sign writes its resulting manifest/document records against
-- the OWNER's user_id (see getRcrainfoClientForSigner's effectiveUserId in
-- src/services/manifestService.ts), so the owner's dashboard shows
-- everything their delegates sign -- these policies let that write through.
-- Additive to the existing "own row" insert/update policies.
drop policy if exists "Delegates can insert manifests for their owner" on public.manifests;
create policy "Delegates can insert manifests for their owner"
  on public.manifests for insert
  with check (public.is_active_delegate_for(user_id));

drop policy if exists "Delegates can update manifests for their owner" on public.manifests;
create policy "Delegates can update manifests for their owner"
  on public.manifests for update
  using (public.is_active_delegate_for(user_id))
  with check (public.is_active_delegate_for(user_id));

drop policy if exists "Delegates can insert documents for their owner" on public.manifest_documents;
create policy "Delegates can insert documents for their owner"
  on public.manifest_documents for insert
  with check (
    exists (
      select 1 from public.manifests
      where manifests.id = manifest_documents.manifest_id
      and public.is_active_delegate_for(manifests.user_id)
    )
  );

drop policy if exists "Delegates can upload document files for their owner" on storage.objects;
create policy "Delegates can upload document files for their owner"
  on storage.objects for insert
  with check (
    bucket_id = 'manifest-documents'
    and public.is_active_delegate_for(((storage.foldername(name))[1])::uuid)
  );

-- Records which owner's credentials a sign action actually used, when it was
-- triggered by a delegate rather than the owner themselves -- null for every
-- ordinary (non-delegated) sign. signature_consents.user_id already records
-- the real actor (see that table's comment), so this column is specifically
-- "who they were acting for," completing the picture required by
-- docs/delegate-quick-sign-design.md's accountability requirement without
-- needing the separate sign_events table that doc originally proposed.
alter table if exists public.signature_consents
  add column if not exists signed_for_owner_user_id uuid references auth.users(id) on delete set null;
