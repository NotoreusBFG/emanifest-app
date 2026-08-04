-- Adds two generator-facing actions to the /transporters status list:
--
-- 1. Cancel a pending invite the generator sent, before it's completed.
--    Low risk -- only touches an invite the generator themselves created
--    (created_by_user_id = auth.uid()), never anything already claimed.
--
-- 2. Revoke an already-REGISTERED transporter's signing access, directly
--    from the inviting generator's own list -- WITHOUT needing the
--    management_token (which is normally only ever sent to the
--    transporter). This is a deliberate product decision, not a default:
--    `transporters` is a global masterlist a transporter shares across
--    every generator they work with, so this means ANY generator who's
--    ever invited a given transporter can now unilaterally cut off that
--    transporter's signing access for every OTHER generator too, without
--    the transporter's or those other generators' knowledge or consent.
--    Explicitly accepted by the product owner 2026-08-03 after that
--    tradeoff was raised. Mitigated (not eliminated) by reusing the same
--    best-effort revoke-notification already built for the
--    management-token path -- whoever originally registered still gets
--    notified regardless of who revoked it.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260816_block_active_reregistration_and_notify_on_revoke.sql already
-- being applied.

alter table public.transporter_registration_tokens
  add column if not exists cancelled_at timestamptz;

-- A cancelled invite must never still be completable -- close that off at
-- both anonymous read paths, not just the generator-facing list.
drop function if exists public.get_transporter_registration_session(uuid);

create or replace function public.get_transporter_registration_session(p_token uuid)
returns table (
  epa_site_id text,
  company_name_snapshot text,
  manifest_epa_mtn text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select
      t.epa_site_id,
      t.company_name_snapshot,
      t.manifest_epa_mtn,
      t.expires_at
    from public.transporter_registration_tokens t
    where t.token = p_token
      and t.used_at is null
      and t.cancelled_at is null
      and t.expires_at > now();
end;
$$;

revoke all on function public.get_transporter_registration_session(uuid) from public;
grant execute on function public.get_transporter_registration_session(uuid) to anon, authenticated;

drop function if exists public.claim_transporter_registration_token(uuid);

create or replace function public.claim_transporter_registration_token(p_token uuid)
returns table (
  token_id uuid,
  epa_site_id text,
  company_name_snapshot text,
  created_by_user_id uuid,
  owner_notify_email text,
  manifest_epa_mtn text,
  recipient_phone text,
  recipient_email text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    update public.transporter_registration_tokens t
    set used_at = now()
    where t.token = p_token
      and t.used_at is null
      and t.cancelled_at is null
      and t.expires_at > now()
      and t.failed_attempt_count < 5
    returning t.id, t.epa_site_id, t.company_name_snapshot, t.created_by_user_id,
      t.owner_notify_email, t.manifest_epa_mtn, t.recipient_phone, t.recipient_email;
end;
$$;

revoke all on function public.claim_transporter_registration_token(uuid) from public;
grant execute on function public.claim_transporter_registration_token(uuid) to anon, authenticated;

-- Body-only change to create_transporter_registration_token -- resending
-- (or re-inviting after a cancel) must clear any prior cancellation,
-- same signature/return type as 20260815's version, plain CREATE OR
-- REPLACE is safe.
create or replace function public.create_transporter_registration_token(
  p_epa_site_id text,
  p_company_name text,
  p_manifest_epa_mtn text,
  p_recipient_phone text,
  p_recipient_email text,
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
    raise exception 'Must be logged in to create a transporter registration invite';
  end if;

  insert into public.transporter_registration_tokens (
    created_by_user_id, epa_site_id, company_name_snapshot, manifest_epa_mtn,
    recipient_phone, recipient_email, owner_notify_email
  )
  values (
    auth.uid(), p_epa_site_id, p_company_name, p_manifest_epa_mtn,
    p_recipient_phone, p_recipient_email, p_owner_notify_email
  )
  on conflict (epa_site_id) where used_at is null do update
    set recipient_phone = coalesce(excluded.recipient_phone, transporter_registration_tokens.recipient_phone),
        recipient_email = coalesce(excluded.recipient_email, transporter_registration_tokens.recipient_email),
        company_name_snapshot = excluded.company_name_snapshot,
        manifest_epa_mtn = coalesce(excluded.manifest_epa_mtn, transporter_registration_tokens.manifest_epa_mtn),
        owner_notify_email = excluded.owner_notify_email,
        created_by_user_id = auth.uid(),
        cancelled_at = null,
        expires_at = now() + interval '14 days',
        failed_attempt_count = 0
  returning transporter_registration_tokens.token into v_token;

  return query select v_token;
end;
$$;

-- Grants unchanged.

-- Generator-facing: cancels an invite THEY created, only while it's still
-- outstanding (never something already claimed/completed).
create or replace function public.cancel_transporter_registration_invite(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Must be logged in to cancel an invite';
  end if;

  update public.transporter_registration_tokens
  set cancelled_at = now()
  where id = p_token_id
    and created_by_user_id = auth.uid()
    and used_at is null;
end;
$$;

revoke all on function public.cancel_transporter_registration_invite(uuid) from public;
grant execute on function public.cancel_transporter_registration_invite(uuid) to authenticated;

-- Generator-facing: revokes an already-registered transporter's signing
-- access -- see the deliberate-tradeoff comment at the top of this file.
-- Authorization is "this generator has invited this site at some point"
-- (same relationship list_transporter_invites_for_owner already scopes
-- by), not ownership of the actual registration. Returns the notify
-- contact directly (same recipient_phone/recipient_email/company_name
-- shape as get_transporter_notify_contact_by_management_token) so the
-- Node layer can send the same best-effort revoke notification in one
-- round trip, without a second lookup call.
create or replace function public.revoke_transporter_for_inviting_generator(p_epa_site_id text)
returns table (recipient_phone text, recipient_email text, company_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_authorized boolean;
begin
  if auth.uid() is null then
    raise exception 'Must be logged in to revoke a transporter';
  end if;

  select exists (
    select 1
    from public.transporter_registration_tokens t
    where t.epa_site_id = p_epa_site_id
      and t.created_by_user_id = auth.uid()
  ) into v_authorized;

  if not v_authorized then
    raise exception 'You have not invited this transporter, so you cannot revoke it.';
  end if;

  update public.transporters
  set revoked_at = now()
  where epa_site_id = p_epa_site_id
    and revoked_at is null;

  return query
    select t.recipient_phone, t.recipient_email, tr.company_name
    from public.transporters tr
    join public.transporter_registration_tokens t on t.completed_transporter_id = tr.id
    where tr.epa_site_id = p_epa_site_id
    order by t.used_at desc nulls last, t.created_at desc
    limit 1;
end;
$$;

revoke all on function public.revoke_transporter_for_inviting_generator(text) from public;
grant execute on function public.revoke_transporter_for_inviting_generator(text) to authenticated;

-- Return-shape change (adds cancelled_at) -- DROP needed first.
drop function if exists public.list_transporter_invites_for_owner();

create or replace function public.list_transporter_invites_for_owner()
returns table (
  token_id uuid,
  epa_site_id text,
  company_name_snapshot text,
  manifest_epa_mtn text,
  recipient_phone text,
  recipient_email text,
  created_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  cancelled_at timestamptz,
  transporter_company_name text,
  transporter_revoked_at timestamptz,
  transporter_pin_set_at timestamptz,
  transporter_has_login_account boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Must be logged in to view transporter invites';
  end if;

  return query
    select
      t.id, t.epa_site_id, t.company_name_snapshot, t.manifest_epa_mtn,
      t.recipient_phone, t.recipient_email, t.created_at, t.expires_at, t.used_at, t.cancelled_at,
      tr.company_name, tr.revoked_at, tr.pin_set_at, (tr.owner_user_id is not null)
    from public.transporter_registration_tokens t
    left join public.transporters tr on tr.epa_site_id = t.epa_site_id
    where t.created_by_user_id = auth.uid()
    order by t.created_at desc;
end;
$$;

revoke all on function public.list_transporter_invites_for_owner() from public;
grant execute on function public.list_transporter_invites_for_owner() to authenticated;
