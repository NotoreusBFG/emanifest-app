-- Pre-existing bug, not introduced by 20260917 -- discovered while
-- live-testing the third-party approval gate: auth.users.email is
-- `character varying(255)`, not `text`, and this project's Postgres
-- (17.6.1.166, sandbox) raises "structure of query does not match
-- function result type" on the RETURN QUERY below rather than silently
-- casting, unlike the implicit varchar->text cast Postgres normally
-- allows. list_pending_profiles() has had this exact query shape since
-- 2026090601_add_approval_gate_to_profiles.sql -- meaning the admin
-- "Pending accounts" panel has likely been silently returning an empty
-- list (the app layer swallows RPC errors, see listPendingAccounts()
-- in profileRepository.ts) instead of ever actually listing anyone,
-- possibly including in production. Explicit ::text cast fixes it
-- regardless of the underlying Postgres-version-specific cause.

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
    select p.user_id, u.email::text, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.approved_at is null and p.account_type in ('generator', 'third_party')
    order by p.created_at asc;
end;
$$;
