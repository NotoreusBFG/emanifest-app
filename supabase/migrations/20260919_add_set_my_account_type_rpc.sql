-- Lets an admin change their own account_type for testing -- e.g. seeing
-- the app as a transporter/disposal/third_party account without a
-- separate test signup. profiles has no update policy for `authenticated`
-- (account_type is meant to be set once at signup, see
-- 20260818_create_profiles_and_account_type.sql), so this needs the same
-- SECURITY DEFINER + is_admin_caller() pattern as approve_profile/
-- reject_profile. Scoped to auth.uid() only -- no target_user_id
-- parameter -- so this can never be used to change *another* user's
-- account type, only the admin's own.

create or replace function public.set_my_account_type(new_account_type text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin_caller() then
    raise exception 'not authorized';
  end if;
  if new_account_type not in ('generator', 'transporter', 'disposal', 'third_party') then
    raise exception 'invalid account_type: %', new_account_type;
  end if;
  update public.profiles set account_type = new_account_type where user_id = auth.uid();
end;
$$;

-- Supabase revokes default PUBLIC execute on new functions -- grant it
-- explicitly, same gotcha 2026090602 fixed for approve_profile/
-- list_pending_profiles. Safe to grant broadly since is_admin_caller()
-- is the real authorization boundary; a non-admin caller's invocation
-- just raises 'not authorized'.
grant execute on function public.set_my_account_type(text) to authenticated;
