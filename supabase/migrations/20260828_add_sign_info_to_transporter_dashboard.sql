-- Adds who-signed-what info to the transporter dashboard
-- (list_manifests_for_transporter_owner, 20260820/20260824) -- the
-- generator's signer name/date and (for this specific transporter leg)
-- the driver's name/ID/truck/date, mirroring what the generator's own
-- dashboard already shows (listDriverSignInfoByMtn /
-- listGeneratorSignInfoByMtn in the Node layer). A transporter-account
-- owner has no direct RLS access to signature_consents (both existing
-- SELECT policies are scoped to the *generator's* owner_user_id, via
-- either direct ownership or a generator/driver sign token's
-- created_by_user_id) -- this function is already the transporter-side
-- cross-ownership read boundary (see its own security-definer reasoning
-- in 20260820_add_transporter_dashboard_rpc.sql), so the sign info is
-- added here rather than inventing a second function.
--
-- Return-shape change -- DROP needed first, same gotcha this function's
-- own history already documents.
--
-- Run via `npx supabase db push`.

drop function if exists public.list_manifests_for_transporter_owner();

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
  last_synced_at timestamptz,
  mmin_encrypted text,
  generator_signer_name text,
  generator_signer_signed_at timestamptz,
  driver_name text,
  driver_id_number text,
  truck_number text,
  driver_signed_at timestamptz
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
      m.updated_at, m.last_synced_at, m.mmin_encrypted,
      gs.generator_signer_name, gs.generator_signer_signed_at,
      ds.driver_name, ds.driver_id_number, ds.truck_number, ds.driver_signed_at
    from public.transporters t
    join public.manifest_transporters mt on mt.transporter_epa_site_id = t.epa_site_id
    join public.manifests m on m.id = mt.manifest_id
    left join lateral (
      select sc.printed_signature_name as generator_signer_name, sc.acknowledged_at as generator_signer_signed_at
      from public.signature_consents sc
      where sc.epa_mtn = m.epa_mtn
        and sc.site_type = 'Generator'
        and sc.sign_succeeded = true
      order by sc.acknowledged_at desc
      limit 1
    ) gs on true
    left join lateral (
      select sc.printed_signature_name as driver_name, sc.driver_id_number, sc.truck_number, sc.acknowledged_at as driver_signed_at
      from public.signature_consents sc
      where sc.epa_mtn = m.epa_mtn
        and sc.site_type = 'Transporter'
        and sc.sign_succeeded = true
        and sc.driver_sign_token_id is not null
        and sc.transporter_order = mt.transporter_order
      order by sc.acknowledged_at desc
      limit 1
    ) ds on true
    where t.owner_user_id = auth.uid()
    order by m.updated_at desc, mt.transporter_order asc;
end;
$$;

revoke all on function public.list_manifests_for_transporter_owner() from public;
grant execute on function public.list_manifests_for_transporter_owner() to authenticated;
