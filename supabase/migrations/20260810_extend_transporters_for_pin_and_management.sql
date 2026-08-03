-- Adds PIN-gated driver signing and a lightweight self-serve
-- manage/revoke mechanism to public.transporters, for the self-serve
-- registration flow added in 20260811_create_transporter_registration_tokens.sql
-- (that migration's complete_transporter_registration function writes
-- pin_hash/management_token, so this one must run FIRST).
--
-- pin_hash: a single company-wide shared PIN (hashed, never stored or
-- returned in plaintext -- see src/lib/pinUtils.ts), required before a
-- driver's signature completes (see submitDriverSignAction). Deliberately
-- ONE PIN per company, not per driver -- a driver-phone roster was
-- considered and rejected as not scaling to companies with hundreds of
-- drivers. This is an access-control gate against a misdirected/forwarded
-- link, not identity proofing -- the driver's typed name/ID/truck number
-- (already collected on every signature) is what stands as the actual
-- signing record. Stays nullable deliberately: existing Phase-1 rows have
-- no PIN until backfilled (see scripts/add-transporter-credentials.ts's
-- --pin flag), and submitDriverSignAction fails CLOSED (not open) when
-- pin_hash is null, matching this app's established pattern of never
-- silently skipping a security gate for an ambiguous state.
--
-- management_token: a DEDICATED bearer secret for the manage/revoke page,
-- deliberately separate from transporters.id -- that id already flows
-- through other code as a plain identifier (driver_sign_tokens.transporter_id,
-- get_transporter_credentials(transporter_id)), not a secret, and reusing
-- it as a bearer token would blur that boundary. Because the default is a
-- volatile function, every pre-existing row gets a real, distinct token
-- the moment this column is added -- no backfill needed for this part.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on 20260803_create_transporters.sql
-- and 20260804_create_driver_sign_tokens.sql already being applied.

alter table public.transporters
  add column if not exists pin_hash text;
alter table public.transporters
  add column if not exists pin_set_at timestamptz;
alter table public.transporters
  add column if not exists management_token uuid not null unique default gen_random_uuid();

-- Extends the existing credential-fetch function with pin_hash, so
-- submitDriverSignAction can verify a driver's entered PIN using the same
-- RPC call it already makes for credentials, rather than a second round
-- trip. Postgres rejects CREATE OR REPLACE when the return type changes
-- (42P13: cannot change return type of existing function) even though the
-- parameter list is unchanged here -- it's not just a parameter-list
-- restriction, so this needs the same DROP FUNCTION first as a
-- parameter-list change would.
drop function if exists public.get_transporter_credentials(uuid);

create or replace function public.get_transporter_credentials(p_transporter_id uuid)
returns table (
  epa_site_id text,
  epa_api_id text,
  epa_api_key text,
  pin_hash text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select t.epa_site_id, t.epa_api_id, t.epa_api_key, t.pin_hash
    from public.transporters t
    where t.id = p_transporter_id
      and t.revoked_at is null;
end;
$$;

revoke all on function public.get_transporter_credentials(uuid) from public;
grant execute on function public.get_transporter_credentials(uuid) to anon, authenticated;

-- The four functions below are deliberately NOT given the
-- failed_attempt_count rate-limit treatment used throughout this app's
-- other anon-reachable tables -- that convention caps retries against a
-- LIMITED-GUESS check (an RCRAInfo call, a PIN guess). These four are
-- plain possession-based bearer-capability actions -- idempotent, harmless
-- to retry, no guessing involved -- so the same pattern would be applied
-- to a shape it doesn't fit.

-- Anonymous-facing: the /manage-transporter/[managementToken] page's
-- display data. Never returns pin_hash or the encrypted credentials.
create or replace function public.get_transporter_management_session(p_management_token uuid)
returns table (
  company_name text,
  epa_site_id text,
  revoked_at timestamptz,
  pin_set_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select t.company_name, t.epa_site_id, t.revoked_at, t.pin_set_at
    from public.transporters t
    where t.management_token = p_management_token;
end;
$$;

revoke all on function public.get_transporter_management_session(uuid) from public;
grant execute on function public.get_transporter_management_session(uuid) to anon, authenticated;

-- Anonymous-facing: revokes signing access for this transporter, for
-- EVERY generator, immediately -- get_transporter_credentials already
-- re-checks revoked_at live at sign time, not just at link-creation time,
-- so this takes effect on any in-flight sign link too.
create or replace function public.revoke_transporter_by_management_token(p_management_token uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.transporters
  set revoked_at = now()
  where management_token = p_management_token
    and revoked_at is null;
end;
$$;

revoke all on function public.revoke_transporter_by_management_token(uuid) from public;
grant execute on function public.revoke_transporter_by_management_token(uuid) to anon, authenticated;

-- Anonymous-facing: pairs with revoke as a toggle, not a one-way door --
-- a transporter isn't permanently locked out once they revoke themselves.
create or replace function public.unrevoke_transporter_by_management_token(p_management_token uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.transporters
  set revoked_at = null
  where management_token = p_management_token
    and revoked_at is not null;
end;
$$;

revoke all on function public.unrevoke_transporter_by_management_token(uuid) from public;
grant execute on function public.unrevoke_transporter_by_management_token(uuid) to anon, authenticated;

-- Anonymous-facing: lets a transporter rotate their PIN at any time,
-- e.g. after an employee who knew it leaves. p_pin_hash is already hashed
-- by the caller (src/lib/pinUtils.ts) -- this function never sees or
-- stores a plaintext PIN.
create or replace function public.update_transporter_pin_by_management_token(p_management_token uuid, p_pin_hash text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.transporters
  set pin_hash = p_pin_hash,
      pin_set_at = now()
  where management_token = p_management_token
    and revoked_at is null;
end;
$$;

revoke all on function public.update_transporter_pin_by_management_token(uuid, text) from public;
grant execute on function public.update_transporter_pin_by_management_token(uuid, text) to anon, authenticated;
