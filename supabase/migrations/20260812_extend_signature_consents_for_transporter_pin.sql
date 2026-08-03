-- Adds pin_verified to signature_consents, so the audit trail records
-- whether the new company-PIN gate (see 20260810_extend_transporters_for_pin_and_management.sql,
-- submitDriverSignAction) was actually satisfied for a given driver-sign
-- attempt. No new site_type value needed -- it's a free `text` column with
-- no CHECK constraint, so this is an added detail on the existing
-- 'Transporter' row, not a new discriminator.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260805_extend_signature_consents_for_driver_sign.sql already being
-- applied.

alter table public.signature_consents
  add column if not exists pin_verified boolean not null default false;

-- record_driver_sign_result gains a parameter (p_pin_verified), so the
-- existing 15-argument version must be DROPped first -- CREATE OR REPLACE
-- only replaces a function whose parameter TYPE LIST matches exactly;
-- otherwise this would silently create a second, coexisting overload
-- rather than actually replacing the old one (the exact gotcha
-- 20260806_add_driver_phone_and_confirmation.sql's own comment already
-- warns about).
drop function if exists public.record_driver_sign_result(
  uuid, text, integer, text, text, text, text, text, text, boolean, text, text, boolean, text, text
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
  p_pin_verified boolean
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
    pin_verified
  )
  values (
    null, null, p_epa_mtn, 'Transporter', p_transporter_order, p_site_id,
    p_driver_name, p_certification_heading, p_certification_text,
    p_certification_is_verbatim, p_ip_address, p_user_agent, p_sign_succeeded,
    p_epa_report_id, p_epa_error, p_driver_id_number, p_truck_number, p_token_id,
    p_pin_verified
  );
end;
$$;

revoke all on function public.record_driver_sign_result(
  uuid, text, integer, text, text, text, text, text, text, boolean, text, text, boolean, text, text, boolean
) from public;
grant execute on function public.record_driver_sign_result(
  uuid, text, integer, text, text, text, text, text, text, boolean, text, text, boolean, text, text, boolean
) to anon, authenticated;
