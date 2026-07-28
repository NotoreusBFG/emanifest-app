-- Stores the driver's phone number on driver_sign_tokens (captured at
-- link-creation time, in createDriverSignLinkAction) so a post-signature
-- confirmation text can be sent back to the SAME number once the driver
-- successfully signs -- see submitDriverSignAction in driverSignActions.ts.
-- Previously the phone number was only ever a transient function
-- parameter, never persisted, so there was no way to text the driver again
-- after the initial send.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260804_create_driver_sign_tokens.sql already being applied.

alter table public.driver_sign_tokens
  add column if not exists driver_phone text;

alter table public.driver_sign_tokens
  drop constraint if exists driver_sign_tokens_driver_phone_length;
alter table public.driver_sign_tokens
  add constraint driver_sign_tokens_driver_phone_length
    check (driver_phone is null or char_length(driver_phone) < 32);

-- Both functions below need to be dropped first, not just `create or
-- replace` -- Postgres allows CREATE OR REPLACE to change a function body
-- but not its parameter list or return type; both are changing here
-- (create_driver_sign_token gains a parameter, claim_driver_sign_token
-- gains a RETURNS TABLE column), so a bare replace would error.

drop function if exists public.create_driver_sign_token(text, uuid, integer, text, text, text);

create or replace function public.create_driver_sign_token(
  p_manifest_epa_mtn text,
  p_transporter_id uuid,
  p_transporter_order integer,
  p_generator_name text,
  p_tsdf_name text,
  p_waste_line_summary text,
  p_driver_phone text
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
    generator_name_snapshot, tsdf_name_snapshot, waste_line_summary_snapshot,
    driver_phone
  )
  values (
    p_manifest_epa_mtn, p_transporter_id, p_transporter_order, auth.uid(),
    p_generator_name, p_tsdf_name, p_waste_line_summary, p_driver_phone
  )
  returning driver_sign_tokens.token into v_token;

  return query select v_token;
end;
$$;

revoke all on function public.create_driver_sign_token(text, uuid, integer, text, text, text, text) from public;
grant execute on function public.create_driver_sign_token(text, uuid, integer, text, text, text, text) to authenticated;

drop function if exists public.claim_driver_sign_token(uuid);

create or replace function public.claim_driver_sign_token(p_token uuid)
returns table (
  token_id uuid,
  transporter_id uuid,
  transporter_order integer,
  epa_mtn text,
  created_by_user_id uuid,
  driver_phone text
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
    returning t.id, t.transporter_id, t.transporter_order, t.manifest_epa_mtn, t.created_by_user_id, t.driver_phone;
end;
$$;

revoke all on function public.claim_driver_sign_token(uuid) from public;
grant execute on function public.claim_driver_sign_token(uuid) to anon, authenticated;
