-- Extends signature_consents to support the SMS-to-driver transporter
-- signing flow -- the first ManifestMate feature where the person
-- actually clicking "Sign" has no auth.users row at all, so user_id
-- (previously always the real caller, per 20260726_create_signature_consents.sql)
-- needs to become nullable for these rows specifically.
-- driver_sign_token_id is what stands in for "who triggered this"
-- instead, tracing back to driver_sign_tokens.created_by_user_id (the
-- generator who sent the link).
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260804_create_driver_sign_tokens.sql already having been applied.

alter table public.signature_consents
  alter column user_id drop not null;

alter table public.signature_consents
  add column if not exists driver_id_number text,
  add column if not exists truck_number text,
  add column if not exists driver_sign_token_id uuid references public.driver_sign_tokens(id);

-- Bounding lengths on the first-ever fields in this app written by a
-- fully unauthenticated party. printed_signature_name already existed but
-- had no length bound either -- adding one now covers both.
alter table public.signature_consents
  add constraint signature_consents_driver_id_number_length
    check (driver_id_number is null or char_length(driver_id_number) < 200),
  add constraint signature_consents_truck_number_length
    check (truck_number is null or char_length(truck_number) < 200),
  add constraint signature_consents_printed_signature_name_length
    check (char_length(printed_signature_name) < 200);

-- Without this, driver-signed rows (user_id null) are invisible through
-- the existing "auth.uid() = user_id" select policy to EVERYONE,
-- including the generator who sent the link -- undercutting the whole
-- point of this audit trail (see the original migration's comment on
-- accountability/informed consent).
drop policy if exists "Generators can view driver-signed consents for their tokens" on public.signature_consents;
create policy "Generators can view driver-signed consents for their tokens"
  on public.signature_consents for select
  using (
    exists (
      select 1 from public.driver_sign_tokens t
      where t.id = signature_consents.driver_sign_token_id
        and t.created_by_user_id = auth.uid()
    )
  );

-- SECURITY DEFINER write path for the driver-sign flow. Created here
-- (not alongside driver_sign_tokens in
-- 20260804_create_driver_sign_tokens.sql) because it references columns
-- added by this migration. anon has no direct insert access to
-- signature_consents (existing policy requires auth.uid() = user_id,
-- which an anonymous driver can never satisfy) -- this function is the
-- only way a driver-signed attempt (success or failure) gets recorded,
-- mirroring signManifestAction's "always record consent, either
-- outcome" behavior in src/app/actions/manifestActions.ts.
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
  p_epa_error text
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
    epa_report_id, epa_error, driver_id_number, truck_number, driver_sign_token_id
  )
  values (
    null, null, p_epa_mtn, 'Transporter', p_transporter_order, p_site_id,
    p_driver_name, p_certification_heading, p_certification_text,
    p_certification_is_verbatim, p_ip_address, p_user_agent, p_sign_succeeded,
    p_epa_report_id, p_epa_error, p_driver_id_number, p_truck_number, p_token_id
  );
end;
$$;

revoke all on function public.record_driver_sign_result(
  uuid, text, integer, text, text, text, text, text, text, boolean, text, text, boolean, text, text
) from public;
grant execute on function public.record_driver_sign_result(
  uuid, text, integer, text, text, text, text, text, text, boolean, text, text, boolean, text, text
) to anon, authenticated;

-- Updates the local manifests mirror's transporter_signed_at after a
-- successful driver sign, so the generator's dashboard reflects it
-- without waiting for their own next login/lookup to re-sync. Scoped to
-- (user_id, epa_mtn) -- both already validated via the claimed token --
-- rather than reusing recordManifestLocally's full upsert (which needs
-- an RLS-backed authenticated client the anonymous write path doesn't
-- have); a plain UPDATE is enough here since the generator's own
-- create/save flow already created this row.
create or replace function public.update_manifest_transporter_signed_at(
  p_user_id uuid,
  p_epa_mtn text,
  p_transporter_signed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.manifests
  set transporter_signed_at = p_transporter_signed_at,
      last_synced_at = now()
  where user_id = p_user_id
    and epa_mtn = p_epa_mtn;
end;
$$;

revoke all on function public.update_manifest_transporter_signed_at(uuid, text, timestamptz) from public;
grant execute on function public.update_manifest_transporter_signed_at(uuid, text, timestamptz) to anon, authenticated;
