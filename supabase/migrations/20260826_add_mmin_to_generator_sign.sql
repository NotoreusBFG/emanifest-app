-- Adds the same per-manifest MMIN gate the transporter driver-sign flow
-- got in 20260824_add_mmin_to_manifests.sql to the generator-delegate sign
-- flow (submitGeneratorSignAction) too. That flow had ZERO secondary
-- verification until now -- a forwarded/misdirected link alone was enough
-- to sign, and unlike driver-sign it uses the ACCOUNT OWNER'S OWN real
-- RCRAInfo credentials, arguably higher stakes than the transporter case.
--
-- Reuses the manifest's existing mmin_encrypted (no new secret) and the
-- signature_consents.mmin_verified column (already added generically in
-- 20260824, not scoped to driver-sign).
--
-- Run via `npx supabase db push` (CLI now linked, see
-- 20260824_add_mmin_to_manifests.sql's own header for the "no CLI"
-- history this replaced).

-- Mirrors get_mmin_for_claimed_token exactly, keyed on a claimed
-- generator_sign_tokens id instead of driver_sign_tokens -- same
-- load-bearing "never a bare/guessable id" property.
create or replace function public.get_mmin_for_claimed_generator_token(p_token_id uuid)
returns table (mmin_encrypted text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select m.mmin_encrypted
    from public.generator_sign_tokens gst
    join public.manifests m on m.epa_mtn = gst.manifest_epa_mtn
    where gst.id = p_token_id
      and gst.used_at is not null;
end;
$$;

revoke all on function public.get_mmin_for_claimed_generator_token(uuid) from public;
grant execute on function public.get_mmin_for_claimed_generator_token(uuid) to anon, authenticated;

-- record_generator_sign_result gains a parameter (p_mmin_verified) -- the
-- existing 12-argument version must be DROPped first, same
-- CREATE-OR-REPLACE-doesn't-handle-a-changed-parameter-list gotcha this
-- function's sibling (record_driver_sign_result) already documents.
drop function if exists public.record_generator_sign_result(
  uuid, text, text, text, text, text, boolean, text, text, boolean, text, text
);

create or replace function public.record_generator_sign_result(
  p_token_id uuid,
  p_epa_mtn text,
  p_site_id text,
  p_signer_name text,
  p_certification_heading text,
  p_certification_text text,
  p_certification_is_verbatim boolean,
  p_ip_address text,
  p_user_agent text,
  p_sign_succeeded boolean,
  p_epa_report_id text,
  p_epa_error text,
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
    epa_report_id, epa_error, generator_sign_token_id, mmin_verified
  )
  values (
    null, null, p_epa_mtn, 'Generator', null, p_site_id,
    p_signer_name, p_certification_heading, p_certification_text,
    p_certification_is_verbatim, p_ip_address, p_user_agent, p_sign_succeeded,
    p_epa_report_id, p_epa_error, p_token_id, p_mmin_verified
  );
end;
$$;

revoke all on function public.record_generator_sign_result(
  uuid, text, text, text, text, text, boolean, text, text, boolean, text, text, boolean
) from public;
grant execute on function public.record_generator_sign_result(
  uuid, text, text, text, text, text, boolean, text, text, boolean, text, text, boolean
) to anon, authenticated;
