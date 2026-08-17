-- Extends signature_consents to support the generator-delegate SMS/email
-- signing flow -- another accountless signer, same "user_id must be
-- nullable" reasoning already established by
-- 20260805_extend_signature_consents_for_driver_sign.sql. No new
-- driver-style ID/truck columns needed here -- printed_signature_name
-- already covers the signer's name, and RCRAInfo's quicker-sign has no
-- analogous field for Generator that Transporter lacks.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260807_create_generator_sign_tokens.sql already having been applied.

alter table public.signature_consents
  add column if not exists generator_sign_token_id uuid references public.generator_sign_tokens(id);

-- Without this, generator-delegate-signed rows (user_id null) are
-- invisible through the existing "auth.uid() = user_id" select policy to
-- EVERYONE, including the owner whose own credentials signed it --
-- same gap 20260805 already closed for driver_sign_token_id.
drop policy if exists "Owners can view generator-delegate-signed consents for their tokens" on public.signature_consents;
create policy "Owners can view generator-delegate-signed consents for their tokens"
  on public.signature_consents for select
  using (
    exists (
      select 1 from public.generator_sign_tokens t
      where t.id = signature_consents.generator_sign_token_id
        and t.owner_user_id = auth.uid()
    )
  );

-- SECURITY DEFINER write path -- anon has no direct insert access to
-- signature_consents (existing policy requires auth.uid() = user_id,
-- which an anonymous signer can never satisfy). Mirrors
-- record_driver_sign_result: site_type is always 'Generator',
-- transporter_order/site_id semantics differ slightly (site_id is the
-- generator's own EPA site ID, derived from the live manifest at sign
-- time -- see submitGeneratorSignAction).
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
    epa_report_id, epa_error, generator_sign_token_id
  )
  values (
    null, null, p_epa_mtn, 'Generator', null, p_site_id,
    p_signer_name, p_certification_heading, p_certification_text,
    p_certification_is_verbatim, p_ip_address, p_user_agent, p_sign_succeeded,
    p_epa_report_id, p_epa_error, p_token_id
  );
end;
$$;

revoke all on function public.record_generator_sign_result(
  uuid, text, text, text, text, text, boolean, text, text, boolean, text, text
) from public;
grant execute on function public.record_generator_sign_result(
  uuid, text, text, text, text, text, boolean, text, text, boolean, text, text
) to anon, authenticated;

-- Updates the local manifests mirror's generator_signed_at, mirroring
-- update_manifest_transporter_signed_at -- the column already exists
-- (2026072601_add_signature_status_to_manifests.sql), no schema change
-- needed there.
create or replace function public.update_manifest_generator_signed_at(
  p_user_id uuid,
  p_epa_mtn text,
  p_generator_signed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.manifests
  set generator_signed_at = p_generator_signed_at,
      last_synced_at = now()
  where user_id = p_user_id
    and epa_mtn = p_epa_mtn;
end;
$$;

revoke all on function public.update_manifest_generator_signed_at(uuid, text, timestamptz) from public;
grant execute on function public.update_manifest_generator_signed_at(uuid, text, timestamptz) to anon, authenticated;
