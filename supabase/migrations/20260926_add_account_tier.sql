-- Minimal manual entitlement scaffold for the new AI wizards (Segregation
-- Wizard, Profile Wizard) -- no billing/Stripe yet, admin-assignable only.
-- Three ordered tiers per client directive 2026-09-26: free < plus < pro.
-- Segregation Wizard requires 'pro', Profile Wizard requires 'plus',
-- Manifest Wizard (no AI cost) stays flag-gated only, no tier requirement.
--
-- profiles has NO update policy for `authenticated` at all (see
-- 20260818_create_profiles_and_account_type.sql's "deliberately no
-- insert/update policy" comment) -- the new `tier` column inherits that
-- same "no client write access" default automatically, so no new RLS
-- policy is needed here. The only write path is set_account_tier() below,
-- a SECURITY DEFINER function gated by is_admin_caller() (the same
-- admin_users-backed check grant_admin()/revoke_admin() use in
-- 2026091702_add_admin_roles.sql) -- not feature_flags' own single
-- hardcoded email, which is that one table's own older, narrower pattern.

alter table public.profiles
  add column if not exists tier text not null default 'free'
    check (tier in ('free', 'plus', 'pro'));

create or replace function public.set_account_tier(target_user_id uuid, new_tier text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin_caller() then
    raise exception 'not authorized';
  end if;
  if new_tier not in ('free', 'plus', 'pro') then
    raise exception 'invalid tier: %', new_tier;
  end if;
  update public.profiles set tier = new_tier, updated_at = now() where user_id = target_user_id;
end;
$$;

-- Lists every account for the admin tier-assignment UI. Mirrors
-- list_pending_profiles()'s exact shape (2026091701_fix_list_pending_profiles_email_cast.sql)
-- including the explicit ::text cast on auth.users.email -- that migration's
-- own comment documents this project's Postgres raising "structure of query
-- does not match function result type" without it (varchar(255) vs text).
create or replace function public.list_accounts_for_tier()
returns table (user_id uuid, email text, account_type text, tier text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin_caller() then
    raise exception 'not authorized';
  end if;
  return query
    select p.user_id, u.email::text, p.account_type, p.tier
    from public.profiles p
    join auth.users u on u.id = p.user_id
    order by u.email::text asc;
end;
$$;

grant execute on function public.set_account_tier(uuid, text) to authenticated;
grant execute on function public.list_accounts_for_tier() to authenticated;
