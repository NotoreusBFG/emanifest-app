-- Seeds the data model for a future login-based transporter identity
-- (part of the separately-roadmapped "MM2.0" multi-role account vision --
-- see project memory) without building a transporter-facing dashboard now.
-- `transporters` stays the single global masterlist keyed by epa_site_id,
-- unchanged -- this just adds an optional link from a row to the
-- auth.users account that completed its registration, so a future
-- transporter dashboard can query `where owner_user_id = auth.uid()`.
--
-- Also adds the read function backing the new generator-facing
-- /transporters status list, and fixes two real bugs newly reachable now
-- that a generator can invite ANY transporter's site standalone (not just
-- one already listed as a handler on one of their own live manifests):
--
-- 1. Cross-generator collision: transporter_registration_tokens_one_pending_per_site_idx
--    is unique on epa_site_id GLOBALLY, not per-generator. The idempotent
--    resend added in 20260814 already overwrites contact info on conflict
--    but never updated created_by_user_id -- so a second, unrelated
--    generator inviting the same still-pending site would silently
--    redirect the first generator's invite while neither generator's
--    status list reflects what actually happened. Fixed by also
--    transferring created_by_user_id to whoever most recently (re)sent
--    it -- accurate for the resender. Residual gap, accepted for v1: the
--    original inviter isn't notified their invite got reassigned;
--    mitigated at the app layer (see createStandaloneTransporterInviteAction)
--    by requiring a deliberate "already pending, resend anyway?"
--    confirmation before this path is reachable at all.
-- 2. manifest_epa_mtn clobber: same conflict-update unconditionally
--    overwrote manifest_epa_mtn, so a manifest-tied invite resent via the
--    new manifest-agnostic standalone form would silently lose its "this
--    was for manifest X" display context. Fixed with COALESCE, same
--    pattern as the existing recipient_phone/recipient_email handling.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260814_make_transporter_invite_resend_idempotent.sql already being
-- applied.

alter table public.transporters
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

-- ON DELETE SET NULL, not CASCADE -- deleting a login account must never
-- delete a shared masterlist row other generators' driver-sign flows
-- depend on.

create index if not exists transporters_owner_user_id_idx
  on public.transporters(owner_user_id)
  where owner_user_id is not null;

-- Body-only change -- signature and return type are unchanged from
-- 20260811's original, so a plain CREATE OR REPLACE is safe here (no
-- DROP FUNCTION dance needed; that's only required when the parameter
-- list or return columns change, per the 42P13 lesson from
-- 20260810_extend_transporters_for_pin_and_management.sql).
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
begin
  insert into public.transporters (epa_site_id, company_name, epa_api_id, epa_api_key, pin_hash, pin_set_at, revoked_at, owner_user_id)
  select t.epa_site_id, p_company_name, p_epa_api_id_encrypted, p_epa_api_key_encrypted, p_pin_hash, now(), null, auth.uid()
  from public.transporter_registration_tokens t
  where t.id = p_token_id
    and t.used_at is not null
  on conflict (epa_site_id) do update
    set company_name = excluded.company_name,
        epa_api_id = excluded.epa_api_id,
        epa_api_key = excluded.epa_api_key,
        pin_hash = excluded.pin_hash,
        pin_set_at = excluded.pin_set_at,
        revoked_at = null,
        -- An anonymous re-registration (auth.uid() null) must never clear
        -- an existing owner link; a login-based one takes over ownership
        -- (matches the existing "last completer wins" model already used
        -- for credentials/PIN).
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

-- Grants unchanged from 20260811 (this function's parameter list/return
-- type didn't change), no need to revoke/re-grant.

-- Body-only change to 20260814's version -- same signature, same return
-- type, plain CREATE OR REPLACE is safe.
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
        -- Bug fix 2 (see migration header): don't let a manifest-agnostic
        -- resend erase an existing manifest-tied invite's display context.
        manifest_epa_mtn = coalesce(excluded.manifest_epa_mtn, transporter_registration_tokens.manifest_epa_mtn),
        owner_notify_email = excluded.owner_notify_email,
        -- Bug fix 1 (see migration header): attribute the invite to
        -- whoever most recently (re)sent it.
        created_by_user_id = auth.uid(),
        expires_at = now() + interval '14 days',
        failed_attempt_count = 0
  returning transporter_registration_tokens.token into v_token;

  return query select v_token;
end;
$$;

-- Grants unchanged from 20260814.

-- Generator-facing: backs the new /transporters status list. Joins
-- transporter_registration_tokens (filtered to the caller's own invites)
-- against transporters' current state by epa_site_id. A function, not an
-- RLS policy, deliberately -- both tables' own migration comments state
-- "deliberately no policies" as an intentional invariant; the status list
-- needs a join across both anyway (transporters must stay deny-all
-- regardless), and a function makes the "never leak pin_hash/credentials/
-- management_token" review trivial -- one enumerated column list in one
-- place, same discipline as 20260813_fix_pin_hash_exposure.sql.
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
      t.recipient_phone, t.recipient_email, t.created_at, t.expires_at, t.used_at,
      tr.company_name, tr.revoked_at, tr.pin_set_at, (tr.owner_user_id is not null)
    from public.transporter_registration_tokens t
    left join public.transporters tr on tr.epa_site_id = t.epa_site_id
    where t.created_by_user_id = auth.uid()
    order by t.created_at desc;
end;
$$;

revoke all on function public.list_transporter_invites_for_owner() from public;
grant execute on function public.list_transporter_invites_for_owner() to authenticated;
