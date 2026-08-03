-- SECURITY FIX, found by review before this feature shipped: 20260810
-- extended get_transporter_credentials(p_transporter_id) to also return
-- pin_hash -- but that function is callable by ANY anon/authenticated
-- caller with just a bare transporter_id, no token/claim check at all
-- (the exact shape get_owner_credentials_for_token's own migration
-- comment already flagged as dangerous, for the same reason: a bare id
-- is often trivially discoverable, e.g. via get_transporter_for_generator
-- which any authenticated user can already call for any EPA site id).
-- Unlike epa_api_id/epa_api_key (AES-256-CBC encrypted, useless without
-- the server-only ENCRYPTION_SECRET_KEY even if leaked), pin_hash is a
-- salted scrypt hash of a bare 4-6 digit PIN -- a keyspace of 10,000 to
-- 1,000,000 candidates, crackable entirely offline in minutes once
-- exposed, voiding the whole point of the PIN gate (catching a
-- misdirected/forwarded sign link).
--
-- Reverts get_transporter_credentials to its pre-20260810 shape (no
-- pin_hash), and adds a new function that only returns pin_hash for a
-- transporter tied to an ALREADY-CLAIMED driver_sign_token -- same
-- token-id-keyed pattern as get_owner_credentials_for_token
-- (20260807_create_generator_sign_tokens.sql), not a bare id.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260810_extend_transporters_for_pin_and_management.sql and
-- 20260804_create_driver_sign_tokens.sql already being applied.

drop function if exists public.get_transporter_credentials(uuid);

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

-- Anonymous-facing: returns pin_hash ONLY for the transporter tied to an
-- ALREADY-CLAIMED driver_sign_token -- keyed on the claimed token id
-- (dst.used_at is not null), never a bare transporter_id.
create or replace function public.get_transporter_pin_hash_for_claimed_token(p_token_id uuid)
returns table (pin_hash text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select t.pin_hash
    from public.driver_sign_tokens dst
    join public.transporters t on t.id = dst.transporter_id
    where dst.id = p_token_id
      and dst.used_at is not null
      and t.revoked_at is null;
end;
$$;

revoke all on function public.get_transporter_pin_hash_for_claimed_token(uuid) from public;
grant execute on function public.get_transporter_pin_hash_for_claimed_token(uuid) to anon, authenticated;
