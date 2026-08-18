-- Two real gaps found live-testing the waste-line-edit delegate flow
-- (2026-08-18): (1) a successful delegate submission never refreshed the
-- local manifests mirror, so the dashboard didn't reflect anything
-- changed until the owner happened to re-look-up the manifest; (2) the
-- owner was never notified at all that a delegate had finished adding
-- waste lines and the manifest might be ready to review/sign. (1) is
-- fixed in the Node layer (recordManifestLocally after a successful
-- update, same as every other manifest-changing action already does).
-- This migration fixes (2), mirroring the existing
-- transporter_registration_tokens.owner_notify_email pattern exactly:
-- capture the owner's email at invite-creation time (when we have a real
-- authenticated session to read it from), not looked up later.
--
-- Run via `npx supabase db push`.

alter table public.waste_line_edit_tokens
  add column if not exists owner_notify_email text;

-- Parameter-list change -- DROP needed first.
drop function if exists public.create_waste_line_edit_token(text, text, text, text, text);

create or replace function public.create_waste_line_edit_token(
  p_manifest_epa_mtn text,
  p_recipient_phone text,
  p_recipient_email text,
  p_generator_name text,
  p_designated_facility_name text,
  p_owner_notify_email text
)
returns table (token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be logged in to create a waste-line-edit link';
  end if;

  insert into public.waste_line_edit_tokens (
    manifest_epa_mtn, owner_user_id, recipient_phone, recipient_email,
    generator_name_snapshot, designated_facility_name_snapshot, owner_notify_email
  )
  values (
    p_manifest_epa_mtn, auth.uid(), p_recipient_phone, p_recipient_email,
    p_generator_name, p_designated_facility_name, p_owner_notify_email
  )
  returning waste_line_edit_tokens.token into v_token;

  return query select v_token;
end;
$$;

revoke all on function public.create_waste_line_edit_token(text, text, text, text, text, text) from public;
grant execute on function public.create_waste_line_edit_token(text, text, text, text, text, text) to authenticated;

-- Return-shape change -- DROP needed first.
drop function if exists public.claim_waste_line_edit_token(uuid);

create or replace function public.claim_waste_line_edit_token(p_token uuid)
returns table (
  token_id uuid,
  owner_user_id uuid,
  epa_mtn text,
  owner_notify_email text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    update public.waste_line_edit_tokens t
    set used_at = now()
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now()
      and t.failed_attempt_count < 5
    returning t.id, t.owner_user_id, t.manifest_epa_mtn, t.owner_notify_email;
end;
$$;

revoke all on function public.claim_waste_line_edit_token(uuid) from public;
grant execute on function public.claim_waste_line_edit_token(uuid) to anon, authenticated;
