-- Closes a real gap: today, ANYONE who completes a fresh registration
-- token for an already-registered, still-active transporter silently
-- overwrites its PIN, RCRAInfo credentials, and company name -- no proof
-- of the existing PIN required. Combined with the standalone /transporters
-- invite path (any generator can invite any transporter's site, not just
-- one on their own manifest), this is a real account-takeover-style
-- surface: an unrelated party could send a fresh invite to an active
-- transporter's site and, if the registrant pastes in ANY valid RCRAInfo
-- credentials (verified live, but never confirmed to match the exact
-- site -- see the disclosed limitation on the registration form), silently
-- take over signing access for that site.
--
-- Fix: complete_transporter_registration now REJECTS completing
-- registration for a site that already has a transporters row which
-- isn't revoked. Only a brand-new site, or a previously-revoked one, can
-- complete -- forcing an explicit "revoke, then re-register" flow through
-- the existing /manage-transporter/[managementToken] page.
--
-- Also adds a notify-contact lookup so revokeTransporterAction (Node
-- layer) can send a best-effort notification to whoever originally
-- registered, regardless of who performs the revoke -- no new column
-- needed, reuses the recipient_phone/recipient_email already captured on
-- the transporter_registration_tokens row that completed this
-- transporter's registration (transporters.id = ...completed_transporter_id).
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260815_transporter_owner_account_and_invite_status.sql already being
-- applied.

-- Body-only change -- signature/return type unchanged, plain CREATE OR
-- REPLACE is safe (no DROP FUNCTION needed).
create or replace function public.complete_transporter_registration(
  p_token_id uuid,
  p_company_name text,
  p_epa_api_id_encrypted text,
  p_epa_api_key_encrypted text,
  p_pin_hash text
)
returns table (transporter_id uuid, management_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transporter_id uuid;
  v_management_token uuid;
  v_epa_site_id text;
  v_existing_revoked_at timestamptz;
  v_existing_exists boolean;
begin
  select t.epa_site_id into v_epa_site_id
  from public.transporter_registration_tokens t
  where t.id = p_token_id
    and t.used_at is not null;

  if v_epa_site_id is null then
    raise exception 'Registration token not found or not claimed';
  end if;

  select true, tr.revoked_at into v_existing_exists, v_existing_revoked_at
  from public.transporters tr
  where tr.epa_site_id = v_epa_site_id;

  if v_existing_exists and v_existing_revoked_at is null then
    raise exception 'This transporter is already registered and active. Whoever manages it must revoke access first (via the management link sent at registration) before it can be registered again.';
  end if;

  insert into public.transporters (epa_site_id, company_name, epa_api_id, epa_api_key, pin_hash, pin_set_at, revoked_at, owner_user_id)
  values (v_epa_site_id, p_company_name, p_epa_api_id_encrypted, p_epa_api_key_encrypted, p_pin_hash, now(), null, auth.uid())
  on conflict (epa_site_id) do update
    set company_name = excluded.company_name,
        epa_api_id = excluded.epa_api_id,
        epa_api_key = excluded.epa_api_key,
        pin_hash = excluded.pin_hash,
        pin_set_at = excluded.pin_set_at,
        revoked_at = null,
        owner_user_id = coalesce(excluded.owner_user_id, transporters.owner_user_id)
  returning transporters.id, transporters.management_token into v_transporter_id, v_management_token;

  if v_transporter_id is null then
    raise exception 'Registration token not found or not claimed';
  end if;

  update public.transporter_registration_tokens
  set completed_transporter_id = v_transporter_id
  where id = p_token_id;

  return query select v_transporter_id, v_management_token;
end;
$$;

-- Grants unchanged (parameter list/return type didn't change).

-- Anonymous-facing: best-effort notify-contact lookup for a revoke action.
-- Deliberately reuses recipient_phone/recipient_email already captured on
-- whichever transporter_registration_tokens row completed this
-- transporter's registration, rather than adding a new column -- picks
-- the most recently completed one if there's more than one (e.g. after a
-- prior revoke-and-reregister cycle). Returns nothing if the transporter
-- was added via the old Phase-1 admin script (no invite token at all) --
-- callers must treat that as an expected, silently-skippable case, same
-- as every other best-effort notification in this app.
create or replace function public.get_transporter_notify_contact_by_management_token(p_management_token uuid)
returns table (recipient_phone text, recipient_email text, company_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select t.recipient_phone, t.recipient_email, tr.company_name
    from public.transporters tr
    join public.transporter_registration_tokens t on t.completed_transporter_id = tr.id
    where tr.management_token = p_management_token
    order by t.used_at desc nulls last, t.created_at desc
    limit 1;
end;
$$;

revoke all on function public.get_transporter_notify_contact_by_management_token(uuid) from public;
grant execute on function public.get_transporter_notify_contact_by_management_token(uuid) to anon, authenticated;
