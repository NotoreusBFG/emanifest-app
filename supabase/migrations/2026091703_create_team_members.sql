-- Team / multi-seat accounts: distinct from quick_sign_delegates (which
-- stays sign-only, thin, no shared visibility -- the driver/staff use
-- case). A team member operates as a full extension of the owner's
-- workspace: same generator sites, same saved waste profiles, same
-- dashboard, and CAN create manifests (not just sign) using the owner's
-- RCRAInfo credentials -- a deliberate widening of the "creation is not
-- delegable" rule from docs/delegate-quick-sign-design.md, but only for
-- this new role, not for Quick-Sign delegates.
--
-- One active team per member (same "no ambiguity about whose data this
-- is" reasoning as quick_sign_delegates' one-active-delegation-per-
-- delegate) -- while a team membership is active, EVERYTHING (data
-- visibility AND EPA credentials) resolves to the owner, even if the
-- member happens to also hold their own credentials. No blended view.
--
-- Team members can SELECT (not insert/delete) generator_managed_sites --
-- only the owner manages which EPA sites the team can act for.

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  member_user_id uuid references auth.users(id) on delete cascade,
  invited_email text not null,
  invite_token uuid not null default gen_random_uuid(),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists team_members_invite_token_idx
  on public.team_members(invite_token);

create unique index if not exists team_members_one_active_member
  on public.team_members(member_user_id)
  where accepted_at is not null and revoked_at is null;

create unique index if not exists team_members_one_pending_invite
  on public.team_members(owner_user_id, lower(invited_email))
  where accepted_at is null and revoked_at is null;

alter table public.team_members enable row level security;

create policy "Owners can view their own team" on public.team_members
  for select using (auth.uid() = owner_user_id);

create policy "Owners can invite team members" on public.team_members
  for insert with check (auth.uid() = owner_user_id);

create policy "Owners can update their own team" on public.team_members
  for update using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

create policy "Members can view memberships naming them" on public.team_members
  for select using (auth.uid() = member_user_id);

create policy "Invitees can view their own pending invite" on public.team_members
  for select using (
    member_user_id is null
    and accepted_at is null
    and lower(invited_email) = lower(auth.jwt() ->> 'email')
  );

create policy "Invitees can accept their own pending invite" on public.team_members
  for update using (
    member_user_id is null
    and accepted_at is null
    and lower(invited_email) = lower(auth.jwt() ->> 'email')
  )
  with check (member_user_id = auth.uid());

-- Helper mirroring is_active_delegate_for (quick_sign_delegates) -- plain
-- SQL, not security definer, relies on the caller's own "view memberships
-- naming them" select policy above.
create or replace function public.is_active_team_member_for(owner uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.team_members m
    where m.owner_user_id = owner
      and m.member_user_id = auth.uid()
      and m.accepted_at is not null
      and m.revoked_at is null
  );
$$;

-- Shared workspace: additive policies, same pattern as quick_sign_delegates'
-- additions to manifests/manifest_documents/storage.objects. View-only on
-- generator_managed_sites; full read/write on waste_profiles, manifests,
-- and label_prints (label_prints already has a public select policy, so
-- only insert needs adding here).

create policy "Team members can view owner's managed sites" on public.generator_managed_sites
  for select using (public.is_active_team_member_for(user_id));

create policy "Team members can view owner's waste profiles" on public.waste_profiles
  for select using (public.is_active_team_member_for(user_id));
create policy "Team members can create waste profiles for owner" on public.waste_profiles
  for insert with check (public.is_active_team_member_for(user_id));
create policy "Team members can update owner's waste profiles" on public.waste_profiles
  for update using (public.is_active_team_member_for(user_id)) with check (public.is_active_team_member_for(user_id));

create policy "Team members can view owner's manifests" on public.manifests
  for select using (public.is_active_team_member_for(user_id));
create policy "Team members can insert manifests for owner" on public.manifests
  for insert with check (public.is_active_team_member_for(user_id));
create policy "Team members can update owner's manifests" on public.manifests
  for update using (public.is_active_team_member_for(user_id)) with check (public.is_active_team_member_for(user_id));

create policy "Team members can insert documents for owner" on public.manifest_documents
  for insert with check (
    exists (
      select 1 from public.manifests
      where manifests.id = manifest_documents.manifest_id
      and public.is_active_team_member_for(manifests.user_id)
    )
  );

create policy "Team members can upload document files for owner" on storage.objects
  for insert with check (
    bucket_id = 'manifest-documents'
    and public.is_active_team_member_for(((storage.foldername(name))[1])::uuid)
  );

create policy "Team members can create labels for owner" on public.label_prints
  for insert with check (public.is_active_team_member_for(user_id));
