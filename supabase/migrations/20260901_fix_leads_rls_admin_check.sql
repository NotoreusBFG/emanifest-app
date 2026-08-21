-- Replaces the leads/lead_activities RLS admin check from 20260831 —
-- current_setting('app.admin_email', true) required `alter database
-- postgres set ...`, which Supabase's hosted Postgres refuses even to the
-- CLI-linked role ("permission denied to set parameter", 42501; that's a
-- superuser-only operation there). This is the actually-workable
-- equivalent: a small admin_users table plus a SECURITY DEFINER lookup
-- function, same pattern Supabase's own multi-tenant RLS examples use for
-- org-membership checks. admin_users has RLS enabled with zero policies,
-- so it's unreadable/unwritable via the PostgREST API by anyone — the
-- SECURITY DEFINER function is the only way in, and it only ever returns a
-- boolean, never the row itself. The actual admin email(s) still never
-- appear in a migration file (seeded separately via `supabase db query`,
-- same reasoning as the 20260831 comment: this repo is public on GitHub).

create table if not exists admin_users (
  email text primary key
);

alter table admin_users enable row level security;

create or replace function is_admin_caller()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admin_users where email = auth.jwt() ->> 'email'
  );
$$;

drop policy if exists "leads_admin_all" on leads;
create policy "leads_admin_all" on leads
  for all
  using (is_admin_caller())
  with check (is_admin_caller());

drop policy if exists "lead_activities_admin_all" on lead_activities;
create policy "lead_activities_admin_all" on lead_activities
  for all
  using (is_admin_caller())
  with check (is_admin_caller());
