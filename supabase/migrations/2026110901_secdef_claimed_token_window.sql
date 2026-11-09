-- Security fix (ManifestMate security review, Matt 2026-11-09). Applies to BOTH the production DB and the sandbox: every
-- function changed here was identical on both when this was written (checked against the live definitions).
--
-- Problem: every SECURITY DEFINER function was executable by `anon` (signed-out callers), and the ones a signing-link flow
-- uses after a link is claimed trusted any id they were handed, forever:
--   - get_transporter_credentials(transporter_id): a transporter's stored EPA API id/key for anyone who knew the id
--     (get_transporter_for_generator hands the id out for a public EPA site id), with no link at all;
--   - update_manifest_*_signed_at(user_id, mtn, ts): rewrite any user's manifest signed-at times;
--   - get_owner_credentials_* / get_mmin_* / record_*: usable with a claimed token id at any later time, and record_* would
--     write a signature-consent row for any manifest number.
--
-- Fix, step 1 (this migration; safe with the code already deployed):
--   - claimed_at: set when a link is claimed and NOT cleared by release (the flows release before recording a failure).
--     Every post-claim function now also requires claimed_at within the last 10 minutes. Each flow claims and finishes
--     inside one server request (seconds), so legitimate use is unaffected.
--   - record_*: also require the token to exist, be freshly claimed and belong to the same manifest number.
--   - New token-scoped replacements: get_transporter_credentials_for_token, set_manifest_transporter_signed_at_for_token,
--     set_manifest_generator_signed_at_for_token (the code switches to these).
--   - Owner/admin-only functions (they already check auth.uid() / is_admin_caller) are no longer executable by anon.
-- Step 2 (2026110903, after the new code is live): revoke the old unscoped functions entirely.

alter table public.driver_sign_tokens add column if not exists claimed_at timestamptz;
alter table public.generator_sign_tokens add column if not exists claimed_at timestamptz;
alter table public.waste_line_edit_tokens add column if not exists claimed_at timestamptz;

-- claim_driver_sign_token
CREATE OR REPLACE FUNCTION public.claim_driver_sign_token(p_token uuid)
 RETURNS TABLE(token_id uuid, transporter_id uuid, transporter_order integer, epa_mtn text, created_by_user_id uuid, driver_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return query
    update public.driver_sign_tokens t
    set used_at = now(), claimed_at = now()
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now()
      and t.failed_attempt_count < 5
    returning t.id, t.transporter_id, t.transporter_order, t.manifest_epa_mtn, t.created_by_user_id, t.driver_phone;
end;
$function$;

-- claim_generator_sign_token
CREATE OR REPLACE FUNCTION public.claim_generator_sign_token(p_token uuid)
 RETURNS TABLE(token_id uuid, owner_user_id uuid, epa_mtn text, recipient_phone text, recipient_email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return query
    update public.generator_sign_tokens t
    set used_at = now(), claimed_at = now()
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now()
      and t.failed_attempt_count < 5
    returning t.id, t.owner_user_id, t.manifest_epa_mtn, t.recipient_phone, t.recipient_email;
end;
$function$;

-- claim_waste_line_edit_token
CREATE OR REPLACE FUNCTION public.claim_waste_line_edit_token(p_token uuid)
 RETURNS TABLE(token_id uuid, owner_user_id uuid, epa_mtn text, owner_notify_email text, allow_sign boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return query
    update public.waste_line_edit_tokens t
    set used_at = now(), claimed_at = now()
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now()
      and t.failed_attempt_count < 5
    returning t.id, t.owner_user_id, t.manifest_epa_mtn, t.owner_notify_email, t.allow_sign;
end;
$function$;

-- get_owner_credentials_for_token
CREATE OR REPLACE FUNCTION public.get_owner_credentials_for_token(p_token_id uuid)
 RETURNS TABLE(epa_api_id text, epa_api_key text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return query
    select uc.epa_api_id, uc.epa_api_key
    from public.generator_sign_tokens t
    join public.user_credentials uc on uc.user_id = t.owner_user_id
    where t.id = p_token_id
      and t.used_at is not null
      and t.claimed_at > now() - interval '10 minutes';
end;
$function$;

-- get_owner_credentials_for_waste_line_token
CREATE OR REPLACE FUNCTION public.get_owner_credentials_for_waste_line_token(p_token_id uuid)
 RETURNS TABLE(epa_api_id text, epa_api_key text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return query
    select uc.epa_api_id, uc.epa_api_key
    from public.waste_line_edit_tokens t
    join public.user_credentials uc on uc.user_id = t.owner_user_id
    where t.id = p_token_id
      and t.used_at is not null
      and t.claimed_at > now() - interval '10 minutes';
end;
$function$;

-- get_mmin_for_claimed_token
CREATE OR REPLACE FUNCTION public.get_mmin_for_claimed_token(p_token_id uuid)
 RETURNS TABLE(mmin_encrypted text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return query
    select m.mmin_encrypted
    from public.driver_sign_tokens dst
    join public.manifests m on m.epa_mtn = dst.manifest_epa_mtn
    where dst.id = p_token_id
      and dst.used_at is not null
      and dst.claimed_at > now() - interval '10 minutes';
end;
$function$;

-- get_mmin_for_claimed_generator_token
CREATE OR REPLACE FUNCTION public.get_mmin_for_claimed_generator_token(p_token_id uuid)
 RETURNS TABLE(mmin_encrypted text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return query
    select m.mmin_encrypted
    from public.generator_sign_tokens gst
    join public.manifests m on m.epa_mtn = gst.manifest_epa_mtn
    where gst.id = p_token_id
      and gst.used_at is not null
      and gst.claimed_at > now() - interval '10 minutes';
end;
$function$;

-- get_mmin_for_claimed_waste_line_token
CREATE OR REPLACE FUNCTION public.get_mmin_for_claimed_waste_line_token(p_token_id uuid)
 RETURNS TABLE(mmin_encrypted text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return query
    select m.mmin_encrypted
    from public.waste_line_edit_tokens wlt
    join public.manifests m on m.epa_mtn = wlt.manifest_epa_mtn
    where wlt.id = p_token_id
      and wlt.used_at is not null
      and wlt.claimed_at > now() - interval '10 minutes';
end;
$function$;

-- record_driver_sign_result
CREATE OR REPLACE FUNCTION public.record_driver_sign_result(p_token_id uuid, p_epa_mtn text, p_transporter_order integer, p_site_id text, p_driver_name text, p_driver_id_number text, p_truck_number text, p_certification_heading text, p_certification_text text, p_certification_is_verbatim boolean, p_ip_address text, p_user_agent text, p_sign_succeeded boolean, p_epa_report_id text, p_epa_error text, p_pin_verified boolean, p_mmin_verified boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not exists (
    select 1 from public.driver_sign_tokens t
    where t.id = p_token_id
      and t.manifest_epa_mtn = p_epa_mtn
      and t.claimed_at > now() - interval '10 minutes'
  ) then
    raise exception 'signing link not claimed';
  end if;

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
$function$;

-- record_generator_sign_result
CREATE OR REPLACE FUNCTION public.record_generator_sign_result(p_token_id uuid, p_epa_mtn text, p_site_id text, p_signer_name text, p_certification_heading text, p_certification_text text, p_certification_is_verbatim boolean, p_ip_address text, p_user_agent text, p_sign_succeeded boolean, p_epa_report_id text, p_epa_error text, p_mmin_verified boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not exists (
    select 1 from public.generator_sign_tokens t
    where t.id = p_token_id
      and t.manifest_epa_mtn = p_epa_mtn
      and t.claimed_at > now() - interval '10 minutes'
  ) then
    raise exception 'signing link not claimed';
  end if;

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
$function$;

-- record_generator_sign_via_waste_line_token
CREATE OR REPLACE FUNCTION public.record_generator_sign_via_waste_line_token(p_token_id uuid, p_epa_mtn text, p_site_id text, p_signer_name text, p_certification_heading text, p_certification_text text, p_certification_is_verbatim boolean, p_ip_address text, p_user_agent text, p_sign_succeeded boolean, p_epa_report_id text, p_epa_error text, p_mmin_verified boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not exists (
    select 1 from public.waste_line_edit_tokens t
    where t.id = p_token_id
      and t.manifest_epa_mtn = p_epa_mtn
      and t.claimed_at > now() - interval '10 minutes'
  ) then
    raise exception 'signing link not claimed';
  end if;

  insert into public.signature_consents (
    user_id, manifest_id, epa_mtn, site_type, transporter_order, site_id,
    printed_signature_name, certification_heading, certification_text,
    certification_is_verbatim, ip_address, user_agent, sign_succeeded,
    epa_report_id, epa_error, waste_line_edit_token_id, mmin_verified
  )
  values (
    null, null, p_epa_mtn, 'Generator', null, p_site_id,
    p_signer_name, p_certification_heading, p_certification_text,
    p_certification_is_verbatim, p_ip_address, p_user_agent, p_sign_succeeded,
    p_epa_report_id, p_epa_error, p_token_id, p_mmin_verified
  );
end;
$function$;

-- record_manifest_edit_consent
CREATE OR REPLACE FUNCTION public.record_manifest_edit_consent(p_waste_line_edit_token_id uuid, p_epa_mtn text, p_mmin_verified boolean, p_edit_succeeded boolean, p_epa_report_id text, p_epa_error text, p_ip_address text, p_user_agent text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not exists (
    select 1 from public.waste_line_edit_tokens t
    where t.id = p_waste_line_edit_token_id
      and t.manifest_epa_mtn = p_epa_mtn
      and t.claimed_at > now() - interval '10 minutes'
  ) then
    raise exception 'signing link not claimed';
  end if;

  insert into public.manifest_edit_consents (
    waste_line_edit_token_id, epa_mtn, mmin_verified, edit_succeeded,
    epa_report_id, epa_error, ip_address, user_agent
  )
  values (
    p_waste_line_edit_token_id, p_epa_mtn, p_mmin_verified, p_edit_succeeded,
    p_epa_report_id, p_epa_error, p_ip_address, p_user_agent
  );
end;
$function$;

-- New: a transporter's credentials only for the driver link that was just claimed (replaces get_transporter_credentials).
create or replace function public.get_transporter_credentials_for_token(p_token_id uuid)
 returns table(epa_site_id text, epa_api_id text, epa_api_key text)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  return query
    select tr.epa_site_id, tr.epa_api_id, tr.epa_api_key
    from public.driver_sign_tokens t
    join public.transporters tr on tr.id = t.transporter_id
    where t.id = p_token_id
      and t.used_at is not null
      and t.claimed_at > now() - interval '10 minutes'
      and tr.revoked_at is null;
end;
$function$;

-- New: the manifest's transporter signed-at time, for the manifest of the driver link that was just claimed
-- (replaces update_manifest_transporter_signed_at, which took any user id + MTN).
create or replace function public.set_manifest_transporter_signed_at_for_token(p_token_id uuid, p_signed_at timestamptz)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.manifests m
  set transporter_signed_at = p_signed_at,
      last_synced_at = now()
  from public.driver_sign_tokens t
  where t.id = p_token_id
    and t.claimed_at > now() - interval '10 minutes'
    and m.user_id = t.created_by_user_id
    and m.epa_mtn = t.manifest_epa_mtn;
end;
$function$;

-- New: the manifest's generator signed-at time, for a generator sign link or a waste-line edit link (with signing) that was
-- just claimed (replaces update_manifest_generator_signed_at).
create or replace function public.set_manifest_generator_signed_at_for_token(p_token_id uuid, p_signed_at timestamptz)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.manifests m
  set generator_signed_at = p_signed_at,
      last_synced_at = now()
  from (
    select g.owner_user_id, g.manifest_epa_mtn from public.generator_sign_tokens g
     where g.id = p_token_id and g.claimed_at > now() - interval '10 minutes'
    union all
    select w.owner_user_id, w.manifest_epa_mtn from public.waste_line_edit_tokens w
     where w.id = p_token_id and w.claimed_at > now() - interval '10 minutes'
  ) t
  where m.user_id = t.owner_user_id
    and m.epa_mtn = t.manifest_epa_mtn;
end;
$function$;

-- The sign pages run as anon (the signer has no account), so the new functions need anon; nothing else does.
revoke all on function public.get_transporter_credentials_for_token(uuid) from public;
revoke all on function public.set_manifest_transporter_signed_at_for_token(uuid, timestamptz) from public;
revoke all on function public.set_manifest_generator_signed_at_for_token(uuid, timestamptz) from public;
grant execute on function public.get_transporter_credentials_for_token(uuid) to anon, authenticated, service_role;
grant execute on function public.set_manifest_transporter_signed_at_for_token(uuid, timestamptz) to anon, authenticated, service_role;
grant execute on function public.set_manifest_generator_signed_at_for_token(uuid, timestamptz) to anon, authenticated, service_role;

-- Owner / admin functions: they already check auth.uid() or is_admin_caller(); signed-out callers have no business here.
-- By name, every overload (create_waste_line_edit_token has an extra argument on the sandbox).
do $do$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'approve_profile', 'list_pending_profiles',
        'create_driver_sign_token', 'create_generator_sign_token', 'create_transporter_registration_token', 'create_waste_line_edit_token',
        'list_manifests_for_transporter_owner', 'list_transporter_invites_for_owner',
        'revoke_transporter_for_inviting_generator', 'cancel_transporter_registration_invite'])
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end
$do$;
