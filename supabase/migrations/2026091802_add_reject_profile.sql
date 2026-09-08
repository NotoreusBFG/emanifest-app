-- Adds a real reject path for pending signups -- previously the admin
-- panel only had Approve, no way to decline one and keep a record of it.
-- rejected_at mirrors approved_at; exactly one of the two (or neither, for
-- a still-pending row) is ever set -- each RPC clears the other, so a
-- rejection can be reversed later by approving, and vice versa.

alter table public.profiles add column if not exists rejected_at timestamptz;

create or replace function public.reject_profile(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin_caller() then
    raise exception 'not authorized';
  end if;
  update public.profiles set rejected_at = now(), approved_at = null where user_id = target_user_id;
end;
$$;

revoke all on function public.reject_profile(uuid) from public;
grant execute on function public.reject_profile(uuid) to authenticated;

-- approve_profile now also clears rejected_at, so approving reverses a
-- prior rejection cleanly.
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
  update public.profiles set approved_at = now(), rejected_at = null where user_id = target_user_id;
end;
$$;

-- Pending now explicitly excludes rejected rows too (previously only
-- approved_at was checked, so a rejected row would have kept showing up
-- as "pending").
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
    where p.approved_at is null and p.rejected_at is null and p.account_type in ('generator', 'third_party')
    order by p.created_at asc;
end;
$$;

-- New: lists rejected accounts, for the admin's own record-keeping and to
-- let them reverse a rejection later.
create or replace function public.list_rejected_profiles()
returns table (user_id uuid, email text, rejected_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin_caller() then
    raise exception 'not authorized';
  end if;
  return query
    select p.user_id, u.email::text, p.rejected_at
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.rejected_at is not null and p.account_type in ('generator', 'third_party')
    order by p.rejected_at desc;
end;
$$;

revoke all on function public.list_rejected_profiles() from public;
grant execute on function public.list_rejected_profiles() to authenticated;
