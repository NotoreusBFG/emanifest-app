-- Read-only status list for a transporter company's login-based dashboard
-- (view-only -- no signing action here; signing stays exclusively on the
-- accountless /sign/[token] SMS driver-sign flow). Depends on:
--   - transporters.owner_user_id (20260815_transporter_owner_account_and_invite_status.sql)
--   - manifest_transporters (20260819_create_manifest_transporters.sql)
--
-- SECURITY DEFINER because this crosses an ownership boundary the client
-- itself must never do directly: a transporter's owner_user_id needs to
-- see manifests rows across EVERY generator that transporter works with
-- (global, not per-generator -- matches the shared-masterlist design),
-- but manifests' own RLS is strictly auth.uid() = user_id (the
-- generator). Same pattern as list_transporter_invites_for_owner -- a
-- function, not a policy, keeps the "never leak more than this one
-- enumerated column list" review trivial (per
-- 20260813_fix_pin_hash_exposure.sql's lesson). Explicitly does NOT
-- select manifests.user_id or any transporters credential/PIN/token
-- column -- this function's whole job is proving none of that leaks
-- through an expanding column list later.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder.

create or replace function public.list_manifests_for_transporter_owner()
returns table (
  epa_mtn text,
  epa_status text,
  generator_name text,
  generator_epa_site_id text,
  designated_facility_name text,
  designated_facility_epa_site_id text,
  generator_signed_at timestamptz,
  transporter_signed_at timestamptz,
  facility_signed_at timestamptz,
  transporter_epa_site_id text,
  transporter_order int,
  updated_at timestamptz,
  last_synced_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Must be logged in to view transporter manifests';
  end if;

  return query
    select
      m.epa_mtn, m.epa_status, m.generator_name, m.generator_epa_site_id,
      m.designated_facility_name, m.designated_facility_epa_site_id,
      m.generator_signed_at, m.transporter_signed_at, m.facility_signed_at,
      mt.transporter_epa_site_id, mt.transporter_order,
      m.updated_at, m.last_synced_at
    from public.transporters t
    join public.manifest_transporters mt on mt.transporter_epa_site_id = t.epa_site_id
    join public.manifests m on m.id = mt.manifest_id
    where t.owner_user_id = auth.uid()
    order by m.updated_at desc, mt.transporter_order asc;
end;
$$;

revoke all on function public.list_manifests_for_transporter_owner() from public;
grant execute on function public.list_manifests_for_transporter_owner() to authenticated;
