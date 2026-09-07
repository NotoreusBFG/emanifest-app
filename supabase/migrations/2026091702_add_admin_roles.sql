-- Extends admin_users (see 20260901_fix_leads_rls_admin_check.sql) with a
-- role distinguishing an ordinary admin from a super admin who can
-- grant/revoke admin access to others. Existing rows default to 'admin' --
-- the intended super admin (notoreusbfg@gmail.com) is promoted separately
-- via `supabase db query`, not here, same "no real email in a migration
-- file" reasoning as 20260901's own comment (this repo is public on
-- GitHub).

alter table admin_users add column if not exists role text not null default 'admin' check (role in ('admin', 'super_admin'));

create or replace function is_super_admin_caller()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admin_users where email = auth.jwt() ->> 'email' and role = 'super_admin'
  );
$$;

-- Grants (or re-grants) plain admin access. Only a super admin can call
-- this -- an ordinary admin cannot create more admins, keeping "who can
-- grant admin" a tight, auditable list rather than something any admin
-- can casually expand.
create or replace function grant_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_super_admin_caller() then
    raise exception 'not authorized';
  end if;
  insert into admin_users (email, role) values (lower(trim(target_email)), 'admin')
  on conflict (email) do nothing;
end;
$$;

-- Revokes admin access. Refuses to demote a super admin through this path
-- (avoids an accidental self-lockout or casual power struggle) --
-- reassigning super_admin status is a manual `supabase db query` action,
-- not exposed here.
create or replace function revoke_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_super_admin_caller() then
    raise exception 'not authorized';
  end if;
  delete from admin_users where email = lower(trim(target_email)) and role <> 'super_admin';
end;
$$;

-- Lists all admins for the admin-management UI. Any admin can view (not
-- just super admins), matching is_admin_caller()'s existing "any admin"
-- scope for list_pending_profiles()/approve_profile().
create or replace function list_admins()
returns table (email text, role text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin_caller() then
    raise exception 'not authorized';
  end if;
  return query select a.email, a.role from admin_users a order by a.role desc, a.email asc;
end;
$$;

-- The caller's own admin role (or null) -- used for the account-type/admin
-- badge shown under the user's email, and to gate the "manage admins" UI
-- to super admins only. SECURITY DEFINER: admin_users has RLS enabled
-- with zero policies, so a plain select would return nothing regardless
-- of a WHERE match.
create or replace function get_my_admin_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from admin_users where email = auth.jwt() ->> 'email';
$$;

grant execute on function is_super_admin_caller() to authenticated;
grant execute on function grant_admin(text) to authenticated;
grant execute on function revoke_admin(text) to authenticated;
grant execute on function list_admins() to authenticated;
grant execute on function get_my_admin_role() to authenticated;
