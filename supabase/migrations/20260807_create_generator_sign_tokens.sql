-- Generator-role delegate signing via SMS/email, no ManifestMate account
-- needed by the recipient -- additive to (not a replacement for) the
-- existing email+account "Quick-Sign delegate" system
-- (quick_sign_delegates), which is right for a standing, repeated
-- relationship. This is a one-time, per-manifest grant for someone who'll
-- never need an account, mirroring the already-shipped SMS-to-driver
-- transporter signing feature (driver_sign_tokens) almost exactly -- just
-- using the account OWNER'S OWN credentials (user_credentials) instead of
-- a third party's (transporters), since there's no separate "generator
-- company" to register -- the owner IS the generator's registered rep.
--
-- Security model: same as driver_sign_tokens -- RLS enabled with ZERO
-- client-facing policies (deny-all). Every read/write goes through a
-- SECURITY DEFINER function below that takes the token (or an
-- already-claimed token id) as an explicit parameter, never relying on
-- RLS row visibility for an anonymous caller.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder.

create table if not exists public.generator_sign_tokens (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  manifest_epa_mtn text not null,
  -- Both "who created this invite" and "whose credentials get used" --
  -- the same person here, unlike driver_sign_tokens' owner/transporter
  -- split, since the owner IS the generator's own registered identity.
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_phone text,
  recipient_email text,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz,
  failed_attempt_count integer not null default 0,
  -- Snapshotted display fields, same reasoning as driver_sign_tokens --
  -- lets the public /sign-generator/[token] page render something to
  -- look at without anon ever needing read access to `manifests`. Never
  -- treated as authoritative for the actual signature -- see
  -- submitGeneratorSignAction, which live re-fetches the manifest.
  generator_name_snapshot text,
  tsdf_name_snapshot text,
  waste_line_summary_snapshot text,
  created_at timestamptz not null default now(),

  constraint generator_sign_tokens_recipient_required
    check (recipient_phone is not null or recipient_email is not null),
  constraint generator_sign_tokens_recipient_phone_length
    check (recipient_phone is null or char_length(recipient_phone) < 32),
  constraint generator_sign_tokens_recipient_email_length
    check (recipient_email is null or char_length(recipient_email) < 320)
);

create unique index if not exists generator_sign_tokens_token_idx on public.generator_sign_tokens(token);
create index if not exists generator_sign_tokens_owner_id_idx on public.generator_sign_tokens(owner_user_id);

-- (A partial unique index on "one live invite per manifest" was
-- considered here -- cheap insurance against an owner accidentally
-- creating duplicate outstanding invites, not a security requirement --
-- but Postgres rejects `now()` in an index predicate (42P17: functions in
-- index predicate must be marked IMMUTABLE, since now() is only STABLE).
-- Not worth a trigger-based workaround for a non-security nicety;
-- RCRAInfo's own already-signed rejection remains the real backstop, same
-- reliance as driver_sign_tokens already has.)

alter table public.generator_sign_tokens enable row level security;

-- Deliberately no policies -- see comment above.

-- Generator-facing: creates a new token. Uses auth.uid() internally as
-- owner_user_id so a caller can't spoof someone else's id via a
-- parameter. Kept thin -- no "does this user have credentials saved yet"
-- check here; that's an app-layer check in createGeneratorSignLinkAction
-- (matching how create_driver_sign_token doesn't embed
-- transporter-existence checks either).
create or replace function public.create_generator_sign_token(
  p_manifest_epa_mtn text,
  p_recipient_phone text,
  p_recipient_email text,
  p_generator_name text,
  p_tsdf_name text,
  p_waste_line_summary text
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
    raise exception 'Must be logged in to create a generator sign link';
  end if;

  insert into public.generator_sign_tokens (
    manifest_epa_mtn, owner_user_id, recipient_phone, recipient_email,
    generator_name_snapshot, tsdf_name_snapshot, waste_line_summary_snapshot
  )
  values (
    p_manifest_epa_mtn, auth.uid(), p_recipient_phone, p_recipient_email,
    p_generator_name, p_tsdf_name, p_waste_line_summary
  )
  returning generator_sign_tokens.token into v_token;

  return query select v_token;
end;
$$;

revoke all on function public.create_generator_sign_token(text, text, text, text, text, text) from public;
grant execute on function public.create_generator_sign_token(text, text, text, text, text, text) to authenticated;

-- Anonymous-facing read: display data for the public
-- /sign-generator/[token] page. Pure read -- never claims/burns the
-- token (some messaging apps auto-fetch a shared URL for a link preview,
-- and that must not consume a real sign attempt).
create or replace function public.get_generator_sign_session(p_token uuid)
returns table (
  epa_mtn text,
  generator_name text,
  tsdf_name text,
  waste_line_summary text,
  expires_at timestamptz
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
      t.tsdf_name_snapshot,
      t.waste_line_summary_snapshot,
      t.expires_at
    from public.generator_sign_tokens t
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now();
end;
$$;

revoke all on function public.get_generator_sign_session(uuid) from public;
grant execute on function public.get_generator_sign_session(uuid) to anon, authenticated;

-- Anonymous-facing: atomically claims the token BEFORE the RCRAInfo call,
-- same double-submit-race reasoning as claim_driver_sign_token.
-- failed_attempt_count < 5 caps retries.
create or replace function public.claim_generator_sign_token(p_token uuid)
returns table (
  token_id uuid,
  owner_user_id uuid,
  epa_mtn text,
  recipient_phone text,
  recipient_email text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    update public.generator_sign_tokens t
    set used_at = now()
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now()
      and t.failed_attempt_count < 5
    returning t.id, t.owner_user_id, t.manifest_epa_mtn, t.recipient_phone, t.recipient_email;
end;
$$;

revoke all on function public.claim_generator_sign_token(uuid) from public;
grant execute on function public.claim_generator_sign_token(uuid) to anon, authenticated;

-- Anonymous-facing: un-claims a token after a failed sign attempt so the
-- signer can retry, incrementing failed_attempt_count -- same pattern as
-- release_driver_sign_token.
create or replace function public.release_generator_sign_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.generator_sign_tokens
  set used_at = null,
      failed_attempt_count = failed_attempt_count + 1
  where id = p_token_id;
end;
$$;

revoke all on function public.release_generator_sign_token(uuid) from public;
grant execute on function public.release_generator_sign_token(uuid) to anon, authenticated;

-- Anonymous-facing: the encrypted credential fetch for an
-- ALREADY-CLAIMED token. Keyed on the token id (not a bare
-- owner_user_id) and requires `used_at is not null` -- i.e. the caller
-- must currently hold a validly-claimed, in-flight signing attempt.
-- This matters more here than in get_transporter_credentials: unlike a
-- transporter_id (only ever handed out internally, pointing at a small
-- admin-provisioned table), owner_user_id IS auth.users.id for a real
-- ManifestMate account -- every logged-in user already knows their own
-- value trivially, so keying this function on a bare owner_user_id
-- parameter would let any authenticated caller pull back ANY other
-- user's encrypted RCRAInfo credentials with no token involved at all.
-- Keying on the claimed token id instead ties this to the one thing
-- actually gated by unguessability + the atomic claim step.
create or replace function public.get_owner_credentials_for_token(p_token_id uuid)
returns table (
  epa_api_id text,
  epa_api_key text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select uc.epa_api_id, uc.epa_api_key
    from public.generator_sign_tokens t
    join public.user_credentials uc on uc.user_id = t.owner_user_id
    where t.id = p_token_id
      and t.used_at is not null;
end;
$$;

revoke all on function public.get_owner_credentials_for_token(uuid) from public;
grant execute on function public.get_owner_credentials_for_token(uuid) to anon, authenticated;
