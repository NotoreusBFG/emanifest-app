-- 2026090601 defined approve_profile()/list_pending_profiles() but, unlike
-- every other RPC in this project (see e.g. 20260806, 20260807), never
-- explicitly granted execute -- Supabase revokes default PUBLIC execute on
-- new functions, so the `authenticated` role couldn't actually call them
-- from the client. Both functions still re-check is_admin_caller()
-- themselves, so granting execute to `authenticated` broadly (rather than
-- some narrower role) is safe -- a non-admin caller's invocation just
-- raises 'not authorized'.

grant execute on function public.approve_profile(uuid) to authenticated;
grant execute on function public.list_pending_profiles() to authenticated;
