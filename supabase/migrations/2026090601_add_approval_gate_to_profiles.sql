-- Adds an approval gate: new self-serve generator signups don't get
-- access to the app until the owner manually approves them. 2026-08-26
-- product decision -- open self-serve generator signup is still the
-- design (see 20260818_create_profiles_and_account_type.sql), but the
-- owner wants a manual checkpoint before granting access rather than
-- fully automatic.
--
-- Transporter accounts are explicitly OUT of scope here -- they're
-- already vetted by the inviting generator (see authActions.ts's
-- signUpAction / login/page.tsx's accountType comment), so gating them
-- again would just add friction with no real benefit.
--
-- Existing users are grandfathered in (approved_at = now()) so this
-- doesn't lock anyone already using the live app out. New profiles rows
-- get approved_at = null (pending) by default -- the column has no
-- default value and handle_new_user_profile() doesn't set it, so this
-- requires no trigger change.

alter table public.profiles add column if not exists approved_at timestamptz;

update public.profiles set approved_at = now() where approved_at is null;

-- Reuses is_admin_caller() from 20260901_fix_leads_rls_admin_check.sql.
-- SECURITY DEFINER so it can write past profiles' read-only RLS (see
-- 20260818's comment -- no insert/update policy exists for
-- `authenticated`). Still checks is_admin_caller() itself as the real
-- authorization boundary -- same belt-and-suspenders reasoning as
-- featureFlagActions.ts's app-layer isAdminEmail() check plus a DB-level
-- check.
create or replace function public.approve_profile(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin_caller() then
    raise exception 'not authorized';
  end if;
  update public.profiles set approved_at = now() where user_id = target_user_id;
end;
$$;

-- Lists pending generator signups for the admin panel, joining auth.users
-- for email (not otherwise readable via the client's anon/authenticated
-- role -- PostgREST doesn't expose the auth schema). Scoped to
-- account_type = 'generator' only, matching the gate's actual scope.
create or replace function public.list_pending_profiles()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin_caller() then
    raise exception 'not authorized';
  end if;
  return query
    select p.user_id, u.email, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.approved_at is null and p.account_type = 'generator'
    order by p.created_at asc;
end;
$$;
