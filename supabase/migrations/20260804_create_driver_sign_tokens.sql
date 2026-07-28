-- Tokens backing the SMS-to-driver transporter signing flow: a generator
-- picks a transporter already on file (public.transporters) and already
-- listed as a handler on their manifest, and ManifestMate texts a link a
-- driver can open with NO ManifestMate account -- the accountless part is
-- the whole point of this feature (see plan.md).
--
-- Security model, since this is the first ManifestMate surface reachable
-- by a fully anonymous visitor: RLS is enabled with ZERO client-facing
-- policies on this table (deny-all), same as public.transporters. A naive
-- policy like `using (used_at is null and expires_at > now())` would look
-- plausible but is actually a live-token enumeration bug -- Postgres RLS
-- has no way to see what a client filtered by, so that policy would let
-- ANY anon query (not just one that happens to filter by the right
-- token) return every currently-active token across every generator's
-- account. Instead, every read/write goes through a SECURITY DEFINER
-- function below that takes the token as an explicit parameter and checks
-- it inside the function body -- the token's own unguessability (a random
-- uuid) is what actually gates access, the same trust model a "magic
-- link" always relies on, not RLS row visibility.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder.

create table if not exists public.driver_sign_tokens (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  manifest_epa_mtn text not null,
  transporter_id uuid not null references public.transporters(id),
  transporter_order integer not null,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  -- Set only on a SUCCESSFUL sign (see claim/release functions below) --
  -- a failed attempt should not permanently burn the link, so the driver
  -- can retry until expiry or until failed_attempt_count hits the cap.
  used_at timestamptz,
  failed_attempt_count integer not null default 0,
  -- Snapshotted display fields, captured at send time by
  -- create_driver_sign_token -- lets the public /sign/[token] page render
  -- something to look at WITHOUT anon ever needing read access to
  -- `manifests`. Never treated as authoritative for the actual signature
  -- or for what gets written to signature_consents -- the sign action
  -- re-fetches the live manifest from RCRAInfo for that (see
  -- driverSignActions.ts), so a manifest amended after the SMS goes out
  -- can't be signed based on stale data.
  generator_name_snapshot text,
  tsdf_name_snapshot text,
  waste_line_summary_snapshot text,
  created_at timestamptz not null default now()
);

create unique index if not exists driver_sign_tokens_token_idx on public.driver_sign_tokens(token);
create index if not exists driver_sign_tokens_created_by_idx on public.driver_sign_tokens(created_by_user_id);

alter table public.driver_sign_tokens enable row level security;

-- Deliberately no policies -- see comment above.

-- Generator-facing: creates a new token for a transporter already
-- verified (by the caller, driverSignActions.ts) to be on file and
-- listed as a handler on this manifest at this order. Uses auth.uid()
-- internally as created_by_user_id so a caller can't spoof someone
-- else's id via a parameter.
create or replace function public.create_driver_sign_token(
  p_manifest_epa_mtn text,
  p_transporter_id uuid,
  p_transporter_order integer,
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
    raise exception 'Must be logged in to create a driver sign link';
  end if;

  insert into public.driver_sign_tokens (
    manifest_epa_mtn, transporter_id, transporter_order, created_by_user_id,
    generator_name_snapshot, tsdf_name_snapshot, waste_line_summary_snapshot
  )
  values (
    p_manifest_epa_mtn, p_transporter_id, p_transporter_order, auth.uid(),
    p_generator_name, p_tsdf_name, p_waste_line_summary
  )
  returning driver_sign_tokens.token into v_token;

  return query select v_token;
end;
$$;

revoke all on function public.create_driver_sign_token(text, uuid, integer, text, text, text) from public;
grant execute on function public.create_driver_sign_token(text, uuid, integer, text, text, text) to authenticated;

-- Anonymous-facing read: the display data for the public /sign/[token]
-- page. Pure read -- deliberately never claims/burns the token, since
-- some messaging apps (iMessage, WhatsApp) auto-fetch a shared URL to
-- generate a link preview, and that must not consume a real sign attempt.
create or replace function public.get_driver_sign_session(p_token uuid)
returns table (
  epa_mtn text,
  transporter_order integer,
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
      t.transporter_order,
      t.generator_name_snapshot,
      t.tsdf_name_snapshot,
      t.waste_line_summary_snapshot,
      t.expires_at
    from public.driver_sign_tokens t
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now();
end;
$$;

revoke all on function public.get_driver_sign_session(uuid) from public;
grant execute on function public.get_driver_sign_session(uuid) to anon, authenticated;

-- Anonymous-facing: atomically claims the token BEFORE the RCRAInfo call
-- is made, closing the double-submit race a naive "check then act"
-- sequence would leave open (two concurrent submissions both passing a
-- read-only check, both hitting RCRAInfo before either records
-- used_at). failed_attempt_count < 5 caps retries -- unlimited retries
-- would mean unlimited real signature attempts against a transporter's
-- live RCRAInfo credentials from an unauthenticated caller for up to 48
-- hours, which token-unguessability alone doesn't protect against.
create or replace function public.claim_driver_sign_token(p_token uuid)
returns table (
  token_id uuid,
  transporter_id uuid,
  transporter_order integer,
  epa_mtn text,
  created_by_user_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    update public.driver_sign_tokens t
    set used_at = now()
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now()
      and t.failed_attempt_count < 5
    returning t.id, t.transporter_id, t.transporter_order, t.manifest_epa_mtn, t.created_by_user_id;
end;
$$;

revoke all on function public.claim_driver_sign_token(uuid) from public;
grant execute on function public.claim_driver_sign_token(uuid) to anon, authenticated;

-- Anonymous-facing: un-claims a token after a failed sign attempt so the
-- driver can retry, incrementing failed_attempt_count. Once that count
-- reaches 5, claim_driver_sign_token's own WHERE clause stops matching
-- the row even with used_at back to null -- the token is effectively
-- burned early rather than riding out the full 48-hour expiry.
create or replace function public.release_driver_sign_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.driver_sign_tokens
  set used_at = null,
      failed_attempt_count = failed_attempt_count + 1
  where id = p_token_id;
end;
$$;

revoke all on function public.release_driver_sign_token(uuid) from public;
grant execute on function public.release_driver_sign_token(uuid) to anon, authenticated;

-- Anonymous-facing: the encrypted credential fetch for an already-claimed
-- token's transporter. Re-checks revoked_at live (not just at
-- link-creation time) so revoking a transporter immediately kills any
-- outstanding links too, not just future ones. Returns ciphertext only --
-- decryption stays in Node via the existing cryptoUtils.ts helper.
create or replace function public.get_transporter_credentials(p_transporter_id uuid)
returns table (
  epa_site_id text,
  epa_api_id text,
  epa_api_key text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select t.epa_site_id, t.epa_api_id, t.epa_api_key
    from public.transporters t
    where t.id = p_transporter_id
      and t.revoked_at is null;
end;
$$;

revoke all on function public.get_transporter_credentials(uuid) from public;
grant execute on function public.get_transporter_credentials(uuid) to anon, authenticated;
