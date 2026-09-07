-- Extends the existing generator approval gate (see
-- 2026090601_add_approval_gate_to_profiles.sql) to also cover third_party
-- signups -- the "prescreen" on third-party accounts specifically, per the
-- generator-locked-selection + third-party customer-list feature plan.
-- Transporter/disposal stay out of scope, same reasoning as before
-- (transporter is already vetted by the inviting generator).
--
-- New third_party rows get approved_at = null (pending) same as generator
-- -- no default value on the column, no trigger change needed, same as
-- 2026090601's own reasoning.

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
    where p.approved_at is null and p.account_type in ('generator', 'third_party')
    order by p.created_at asc;
end;
$$;
