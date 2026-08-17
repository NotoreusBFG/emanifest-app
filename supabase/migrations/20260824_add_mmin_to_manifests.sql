-- Replaces the static, company-wide transporter PIN (transporters.pin_hash,
-- see 20260810_extend_transporters_for_pin_and_management.sql) with a
-- per-manifest 4-digit MMIN (ManifestMate Identification Number),
-- generated once per manifest and shown to the generator/dispatcher AND
-- the transporter to relay to the driver verbally -- same out-of-band
-- principle as the old PIN, but scoped to one shipment instead of a
-- standing company-wide secret. Problems this fixes: (1) one PIN leak
-- compromised every future manifest for that transporter indefinitely;
-- (2) there was no self-serve recovery if the one-time
-- /manage-transporter/[managementToken] link was lost -- this was hit
-- live and required hand-running a SUPABASE_SERVICE_ROLE_KEY script
-- (scripts/reset-transporter-pin.ts, now deleted) to recover.
--
-- Stored ENCRYPTED, not hashed (unlike the old pin_hash) -- it must be
-- displayed back to two different dashboards, so a one-way hash doesn't
-- work here. Uses the same AES-256-CBC scheme as
-- transporters.epa_api_id/epa_api_key (src/lib/cryptoUtils.ts) --
-- ciphertext alone is safe to return through an anon-facing RPC, same
-- reasoning as get_transporter_credentials.
--
-- Nullable, not backfilled here: encryption needs the Node-only
-- ENCRYPTION_SECRET_KEY, which this SQL-editor-run migration has no
-- access to. Existing rows get an MMIN from a companion one-off script
-- (scripts/backfill-mmin.ts, run once by hand right after this
-- migration) -- new rows get one lazily the moment recordManifestLocally()
-- first creates their mirror row (save, sign, or lookup), so the backfill
-- script only needs to close the gap for rows that predate this column.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as every other
-- migration in this folder.

alter table public.manifests
  add column if not exists mmin_encrypted text;

-- Anonymous-facing: the driver-sign page's MMIN check. Keyed on the
-- CLAIMED token id, never a bare manifest/transporter id -- same
-- load-bearing security property get_transporter_pin_hash_for_claimed_token
-- established (see 20260813_fix_pin_hash_exposure.sql's lesson). Crosses
-- from the deny-all driver_sign_tokens table into manifests (which
-- normally has strict auth.uid() = user_id RLS), so SECURITY DEFINER is
-- required and is the whole point here, same as get_transporter_credentials
-- already does for transporters.
create or replace function public.get_mmin_for_claimed_token(p_token_id uuid)
returns table (mmin_encrypted text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select m.mmin_encrypted
    from public.driver_sign_tokens dst
    join public.manifests m on m.epa_mtn = dst.manifest_epa_mtn
    where dst.id = p_token_id
      and dst.used_at is not null;
end;
$$;

revoke all on function public.get_mmin_for_claimed_token(uuid) from public;
grant execute on function public.get_mmin_for_claimed_token(uuid) to anon, authenticated;

-- Transporter-dashboard visibility: widens list_manifests_for_transporter_owner
-- (20260820_add_transporter_dashboard_rpc.sql) to also return mmin_encrypted.
-- That function's original comment promised it never returns
-- credential/PIN/token-shaped data -- a deliberate, conscious departure
-- from that invariant, not an accidental widening: this function already
-- scopes strictly to t.owner_user_id = auth.uid() (the authenticated
-- transporter-account owner), not a bare/guessable id, so it isn't the
-- same bug shape as the two prior incidents that comment was guarding
-- against (get_owner_credentials_for_token, get_transporter_credentials's
-- pin_hash exposure). A transporter-dashboard login compromise now
-- exposes MMINs for every manifest that company handles -- but since MMIN
-- is per-manifest (unlike the old company-wide PIN), that's a narrower
-- blast radius than what existed before this migration.
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
  mmin_encrypted text
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
      m.updated_at, m.last_synced_at, m.mmin_encrypted
    from public.transporters t
    join public.manifest_transporters mt on mt.transporter_epa_site_id = t.epa_site_id
    join public.manifests m on m.id = mt.manifest_id
    where t.owner_user_id = auth.uid()
    order by m.updated_at desc, mt.transporter_order asc;
end;
$$;

revoke all on function public.list_manifests_for_transporter_owner() from public;
grant execute on function public.list_manifests_for_transporter_owner() to authenticated;

-- signature_consents audit trail: don't drop/repurpose pin_verified --
-- it's compliance-relevant sign-attempt history, a different risk class
-- than dropping transporters.pin_hash (current operational state only).
-- Add mmin_verified alongside it; pin_verified stays frozen as historical
-- record, all new rows carry pin_verified = false, mmin_verified = <real>.
alter table public.signature_consents
  add column if not exists mmin_verified boolean not null default false;

-- record_driver_sign_result gains a parameter (p_mmin_verified) -- the
-- existing 16-argument version must be DROPped first, same
-- CREATE-OR-REPLACE-doesn't-handle-a-changed-parameter-list gotcha this
-- function's own history already documents (see
-- 20260812_extend_signature_consents_for_transporter_pin.sql).
drop function if exists public.record_driver_sign_result(
  uuid, text, integer, text, text, text, text, text, text, boolean, text, text, boolean, text, text, boolean
);

create or replace function public.record_driver_sign_result(
  p_token_id uuid,
  p_epa_mtn text,
  p_transporter_order integer,
  p_site_id text,
  p_driver_name text,
  p_driver_id_number text,
  p_truck_number text,
  p_certification_heading text,
  p_certification_text text,
  p_certification_is_verbatim boolean,
  p_ip_address text,
  p_user_agent text,
  p_sign_succeeded boolean,
  p_epa_report_id text,
  p_epa_error text,
  p_pin_verified boolean,
  p_mmin_verified boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.signature_consents (
    user_id, manifest_id, epa_mtn, site_type, transporter_order, site_id,
    printed_signature_name, certification_heading, certification_text,
    certification_is_verbatim, ip_address, user_agent, sign_succeeded,
    epa_report_id, epa_error, driver_id_number, truck_number, driver_sign_token_id,
    pin_verified, mmin_verified
  )
  values (
    null, null, p_epa_mtn, 'Transporter', p_transporter_order, p_site_id,
    p_driver_name, p_certification_heading, p_certification_text,
    p_certification_is_verbatim, p_ip_address, p_user_agent, p_sign_succeeded,
    p_epa_report_id, p_epa_error, p_driver_id_number, p_truck_number, p_token_id,
    p_pin_verified, p_mmin_verified
  );
end;
$$;

revoke all on function public.record_driver_sign_result(
  uuid, text, integer, text, text, text, text, text, text, boolean, text, text, boolean, text, text, boolean, boolean
) from public;
grant execute on function public.record_driver_sign_result(
  uuid, text, integer, text, text, text, text, text, text, boolean, text, text, boolean, text, text, boolean, boolean
) to anon, authenticated;
