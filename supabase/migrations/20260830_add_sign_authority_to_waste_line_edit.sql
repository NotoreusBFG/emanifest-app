-- Optional: lets the owner grant the SAME waste-line-edit delegate the
-- power to also sign as Generator, in the same session -- confirmed with
-- the user as a deliberate, warned-about option, not a default. Reuses
-- the exact certification text and record-keeping shape
-- submitGeneratorSignAction/record_generator_sign_result already use, so
-- "who signed" stays accurate on the dashboard for this path too
-- (listGeneratorSignInfoByMtn reads signature_consents directly).
--
-- Two SEPARATE things this migration covers:
-- 1. allow_sign flag threaded through the waste-line-edit token's
--    create/read/claim functions.
-- 2. signature_consents gets its own dedicated waste_line_edit_token_id
--    FK + SELECT policy, same pattern as driver_sign_token_id/
--    generator_sign_token_id -- without the policy, a real sign that
--    happens through this path would be invisible to the owner despite
--    the row existing (same gap 20260805/20260808 already had to close
--    for their own token types).
--
-- Run via `npx supabase db push`. Depends on
-- 20260829_add_owner_notify_to_waste_line_edit.sql already applied.

alter table public.waste_line_edit_tokens
  add column if not exists allow_sign boolean not null default false;

-- Parameter-list change -- DROP needed first.
drop function if exists public.create_waste_line_edit_token(text, text, text, text, text, text);

create or replace function public.create_waste_line_edit_token(
  p_manifest_epa_mtn text,
  p_recipient_phone text,
  p_recipient_email text,
  p_generator_name text,
  p_designated_facility_name text,
  p_owner_notify_email text,
  p_allow_sign boolean
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
    generator_name_snapshot, designated_facility_name_snapshot, owner_notify_email,
    allow_sign
  )
  values (
    p_manifest_epa_mtn, auth.uid(), p_recipient_phone, p_recipient_email,
    p_generator_name, p_designated_facility_name, p_owner_notify_email,
    p_allow_sign
  )
  returning waste_line_edit_tokens.token into v_token;

  return query select v_token;
end;
$$;

revoke all on function public.create_waste_line_edit_token(text, text, text, text, text, text, boolean) from public;
grant execute on function public.create_waste_line_edit_token(text, text, text, text, text, text, boolean) to authenticated;

-- Return-shape change -- DROP needed first. allow_sign is safe to expose
-- pre-claim (a flag, not sensitive) -- the delegate page needs to know
-- this BEFORE the MMIN step so it can show the warning/certification
-- block up front, not as a surprise after waste lines are already filled
-- in.
drop function if exists public.get_waste_line_edit_session(uuid);

create or replace function public.get_waste_line_edit_session(p_token uuid)
returns table (
  epa_mtn text,
  generator_name text,
  designated_facility_name text,
  expires_at timestamptz,
  allow_sign boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select
      t.manifest_epa_mtn,
      t.generator_name_snapshot,
      t.designated_facility_name_snapshot,
      t.expires_at,
      t.allow_sign
    from public.waste_line_edit_tokens t
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now();
end;
$$;

revoke all on function public.get_waste_line_edit_session(uuid) from public;
grant execute on function public.get_waste_line_edit_session(uuid) to anon, authenticated;

-- Return-shape change -- DROP needed first.
drop function if exists public.claim_waste_line_edit_token(uuid);

create or replace function public.claim_waste_line_edit_token(p_token uuid)
returns table (
  token_id uuid,
  owner_user_id uuid,
  epa_mtn text,
  owner_notify_email text,
  allow_sign boolean
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
    returning t.id, t.owner_user_id, t.manifest_epa_mtn, t.owner_notify_email, t.allow_sign;
end;
$$;

revoke all on function public.claim_waste_line_edit_token(uuid) from public;
grant execute on function public.claim_waste_line_edit_token(uuid) to anon, authenticated;

-- signature_consents gets its own dedicated FK, mirroring
-- driver_sign_token_id/generator_sign_token_id exactly.
alter table public.signature_consents
  add column if not exists waste_line_edit_token_id uuid references public.waste_line_edit_tokens(id);

drop policy if exists "Owners can view waste-line-delegate-signed consents for their tokens" on public.signature_consents;
create policy "Owners can view waste-line-delegate-signed consents for their tokens"
  on public.signature_consents for select
  using (
    exists (
      select 1 from public.waste_line_edit_tokens t
      where t.id = signature_consents.waste_line_edit_token_id
        and t.owner_user_id = auth.uid()
    )
  );

-- SECURITY DEFINER write path -- mirrors record_generator_sign_result
-- (20260808, extended with p_mmin_verified in 20260826) exactly, just
-- keyed on waste_line_edit_token_id instead of generator_sign_token_id.
-- A dedicated function (not a reuse of record_generator_sign_result) so
-- this grant stays its own narrowly-scoped, independently reviewable
-- thing -- same reasoning already applied to
-- get_owner_credentials_for_waste_line_token.
create or replace function public.record_generator_sign_via_waste_line_token(
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
    epa_report_id, epa_error, waste_line_edit_token_id, mmin_verified
  )
  values (
    null, null, p_epa_mtn, 'Generator', null, p_site_id,
    p_signer_name, p_certification_heading, p_certification_text,
    p_certification_is_verbatim, p_ip_address, p_user_agent, p_sign_succeeded,
    p_epa_report_id, p_epa_error, p_token_id, p_mmin_verified
  );
end;
$$;

revoke all on function public.record_generator_sign_via_waste_line_token(
  uuid, text, text, text, text, text, boolean, text, text, boolean, text, text, boolean
) from public;
grant execute on function public.record_generator_sign_via_waste_line_token(
  uuid, text, text, text, text, text, boolean, text, text, boolean, text, text, boolean
) to anon, authenticated;
