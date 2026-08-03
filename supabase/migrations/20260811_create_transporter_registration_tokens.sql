-- Self-serve transporter registration: closes the Phase-1 gap noted in
-- 20260803_create_transporters.sql's own header comment -- until now, the
-- ONLY way a transporter company got into `public.transporters` was the app
-- owner manually running scripts/add-transporter-credentials.ts, which also
-- never verified the pasted credentials against RCRAInfo at all. This lets a
-- generator invite a transporter (already listed as a handler on one of
-- their own live manifests) to register themselves via a one-time link,
-- pasting their own RCRAInfo API ID/Key, live-verified before it's ever
-- persisted -- see completeTransporterRegistrationAction.
--
-- Security model: same as every other anon-reachable table in this app --
-- RLS enabled with ZERO client-facing policies (deny-all). Every read/write
-- goes through a SECURITY DEFINER function below, keyed on the token (or an
-- already-claimed token id), never on RLS row visibility.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260810_extend_transporters_for_pin_and_management.sql already being
-- applied -- complete_transporter_registration below writes
-- pin_hash/management_token, both added by that migration.

create table if not exists public.transporter_registration_tokens (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  -- Anchored from the LIVE manifest at invite time (manifest.transporters[].epaSiteId,
  -- the same source createDriverSignLinkAction already reads) -- never
  -- free-typed by the generator, so a typo can't misdirect who gets invited
  -- to register under which site id.
  epa_site_id text not null,
  company_name_snapshot text,
  manifest_epa_mtn text,
  recipient_phone text,
  recipient_email text,
  -- Deliberately longer than the 48h sign-token windows -- this asks
  -- someone to go generate a real RCRAInfo API key in their own MyRCRAInfo
  -- account first, real-world lead time a signing link doesn't need.
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz,
  failed_attempt_count integer not null default 0,
  -- Set on a successful registration -- lets the generator-notification
  -- step and any future "my sent invites" view resolve which transporter
  -- row resulted, without a second lookup.
  completed_transporter_id uuid references public.transporters(id),
  -- Snapshot of the inviting generator's own auth.users.email, captured at
  -- creation time in Node (supabase.auth.getUser()) -- same "snapshot
  -- rather than re-look-up from an anon context" reasoning as the other
  -- *_snapshot columns, since the completion step runs anonymously and
  -- must not need to touch auth.users.
  owner_notify_email text,
  created_at timestamptz not null default now(),

  constraint transporter_registration_tokens_recipient_required
    check (recipient_phone is not null or recipient_email is not null),
  constraint transporter_registration_tokens_recipient_phone_length
    check (recipient_phone is null or char_length(recipient_phone) < 32),
  constraint transporter_registration_tokens_recipient_email_length
    check (recipient_email is null or char_length(recipient_email) < 320)
);

create unique index if not exists transporter_registration_tokens_token_idx
  on public.transporter_registration_tokens(token);
create index if not exists transporter_registration_tokens_created_by_idx
  on public.transporter_registration_tokens(created_by_user_id);

-- One outstanding (unused, unexpired-by-used_at) invite per site --
-- `used_at is null` is a stable predicate, unlike the `now() > expires_at`
-- idea 20260807's migration comment already rejected (Postgres requires
-- IMMUTABLE, not STABLE, in an index predicate), so this one is buildable.
create unique index if not exists transporter_registration_tokens_one_pending_per_site_idx
  on public.transporter_registration_tokens(epa_site_id)
  where used_at is null;

alter table public.transporter_registration_tokens enable row level security;

-- Deliberately no policies -- see comment above.

-- Generator-facing: creates a new invite. Uses auth.uid() internally as
-- created_by_user_id so a caller can't spoof someone else's id via a
-- parameter -- same pattern as create_generator_sign_token.
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
  returning transporter_registration_tokens.token into v_token;

  return query select v_token;
end;
$$;

revoke all on function public.create_transporter_registration_token(text, text, text, text, text, text) from public;
grant execute on function public.create_transporter_registration_token(text, text, text, text, text, text) to authenticated;

-- Anonymous-facing read: display data for the public
-- /register-transporter/[token] page. Pure read -- never claims/burns the
-- token, same link-preview-bot protection as get_generator_sign_session.
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
      and t.expires_at > now();
end;
$$;

revoke all on function public.get_transporter_registration_session(uuid) from public;
grant execute on function public.get_transporter_registration_session(uuid) to anon, authenticated;

-- Anonymous-facing: atomically claims the token BEFORE the live RCRAInfo
-- credential check, same double-submit-race reasoning as
-- claim_generator_sign_token / claim_driver_sign_token.
-- failed_attempt_count < 5 caps retries.
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
      and t.expires_at > now()
      and t.failed_attempt_count < 5
    returning t.id, t.epa_site_id, t.company_name_snapshot, t.created_by_user_id,
      t.owner_notify_email, t.manifest_epa_mtn, t.recipient_phone, t.recipient_email;
end;
$$;

revoke all on function public.claim_transporter_registration_token(uuid) from public;
grant execute on function public.claim_transporter_registration_token(uuid) to anon, authenticated;

-- Anonymous-facing: un-claims a token after a failed live credential check
-- so the transporter can retry, incrementing failed_attempt_count -- same
-- pattern as release_generator_sign_token / release_driver_sign_token.
create or replace function public.release_transporter_registration_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.transporter_registration_tokens
  set used_at = null,
      failed_attempt_count = failed_attempt_count + 1
  where id = p_token_id;
end;
$$;

revoke all on function public.release_transporter_registration_token(uuid) from public;
grant execute on function public.release_transporter_registration_token(uuid) to anon, authenticated;

-- Anonymous-facing: the actual write into public.transporters. The
-- highest-risk function in this migration -- keyed on the CLAIMED token id
-- (t.id = p_token_id and t.used_at is not null), never a bare parameter,
-- same reasoning as get_owner_credentials_for_token's fix: this is the one
-- place an anonymous caller triggers a write of real RCRAInfo credentials
-- into the global masterlist, so epa_site_id is read from the claimed
-- token row itself, NEVER accepted as a caller-supplied parameter -- a
-- malicious completion call must not be able to register credentials
-- against an arbitrary site. `management_token` is deliberately excluded
-- from the `do update set` list so re-registering an existing transporter
-- never invalidates a manage link they may already have saved.
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
  insert into public.transporters (epa_site_id, company_name, epa_api_id, epa_api_key, pin_hash, pin_set_at, revoked_at)
  select t.epa_site_id, p_company_name, p_epa_api_id_encrypted, p_epa_api_key_encrypted, p_pin_hash, now(), null
  from public.transporter_registration_tokens t
  where t.id = p_token_id
    and t.used_at is not null
  on conflict (epa_site_id) do update
    set company_name = excluded.company_name,
        epa_api_id = excluded.epa_api_id,
        epa_api_key = excluded.epa_api_key,
        pin_hash = excluded.pin_hash,
        pin_set_at = excluded.pin_set_at,
        revoked_at = null
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

revoke all on function public.complete_transporter_registration(uuid, text, text, text, text) from public;
grant execute on function public.complete_transporter_registration(uuid, text, text, text, text) to anon, authenticated;

-- Generator-facing: lets the UI distinguish "never invited" from "invited,
-- awaiting completion" without exposing anything else about the token --
-- closes the dead-end gap where SendForSignature.tsx's InviteTransporterPanel
-- previously showed the same raw error every time, with no way to tell
-- whether an invite had already been sent.
create or replace function public.has_pending_transporter_invite(p_epa_site_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1
    from public.transporter_registration_tokens t
    where t.epa_site_id = p_epa_site_id
      and t.used_at is null
      and t.expires_at > now()
  );
end;
$$;

revoke all on function public.has_pending_transporter_invite(text) from public;
grant execute on function public.has_pending_transporter_invite(text) to authenticated;
