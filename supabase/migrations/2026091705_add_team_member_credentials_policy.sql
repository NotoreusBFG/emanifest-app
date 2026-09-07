-- Missed in 2026091703_create_team_members.sql: user_credentials' own RLS
-- only allows a user to see their own row (auth.uid() = user_id), and
-- quick_sign_delegates already has an equivalent additive policy for
-- delegates -- team members need the same, or getEpaCredentials(owner)
-- silently returns null under a team member's session (RLS-blocked, not
-- "no credentials saved"), which getRcrainfoClientForAction/
-- getRcrainfoClientForCreate then misreport as NoCredentialsError.
--
-- Confirmed live 2026-09-07: a team member's /manifests/new correctly
-- auto-selected the owner's generator site (generator_managed_sites'
-- select policy worked) but then failed site-detail lookup with "No
-- RCRAInfo API credentials saved yet" even though the owner has real
-- credentials -- this policy is the fix.

create policy "Team members can view owner credentials" on public.user_credentials
  for select using (public.is_active_team_member_for(user_id));
