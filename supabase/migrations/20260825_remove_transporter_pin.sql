-- Hard cutover, companion to 20260824_add_mmin_to_manifests.sql: removes
-- the static company-wide transporter PIN entirely now that MMIN replaces
-- it. No transitional dual-support period -- see that migration's header
-- for why.
--
-- Run this in the Supabase Dashboard -> SQL Editor, AFTER
-- 20260824_add_mmin_to_manifests.sql and its companion
-- scripts/backfill-mmin.ts backfill.

-- Functions that existed only to create/read/rotate pin_hash.
drop function if exists public.get_transporter_pin_hash_for_claimed_token(uuid);
drop function if exists public.update_transporter_pin_by_management_token(uuid, text);

-- get_transporter_management_session: drop pin_set_at from its return —
-- return-shape change, needs DROP first.
drop function if exists public.get_transporter_management_session(uuid);

create or replace function public.get_transporter_management_session(p_management_token uuid)
returns table (
  company_name text,
  epa_site_id text,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select t.company_name, t.epa_site_id, t.revoked_at
    from public.transporters t
    where t.management_token = p_management_token;
end;
$$;

revoke all on function public.get_transporter_management_session(uuid) from public;
grant execute on function public.get_transporter_management_session(uuid) to anon, authenticated;

-- list_transporter_invites_for_owner: drop transporter_pin_set_at from
-- its return — return-shape change, needs DROP first. (transporter_pin_set_at
-- was never actually rendered anywhere in the UI, confirmed before removing.)
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
      tr.company_name, tr.revoked_at, (tr.owner_user_id is not null)
    from public.transporter_registration_tokens t
    left join public.transporters tr on tr.epa_site_id = t.epa_site_id
    where t.created_by_user_id = auth.uid()
    order by t.created_at desc;
end;
$$;

revoke all on function public.list_transporter_invites_for_owner() from public;
grant execute on function public.list_transporter_invites_for_owner() to authenticated;

-- complete_transporter_registration: drop p_pin_hash param — parameter
-- list change, needs DROP first.
drop function if exists public.complete_transporter_registration(uuid, text, text, text, text);

create or replace function public.complete_transporter_registration(
  p_token_id uuid,
  p_company_name text,
  p_epa_api_id_encrypted text,
  p_epa_api_key_encrypted text
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

  insert into public.transporters (epa_site_id, company_name, epa_api_id, epa_api_key, revoked_at, owner_user_id)
  values (v_epa_site_id, p_company_name, p_epa_api_id_encrypted, p_epa_api_key_encrypted, null, auth.uid())
  on conflict (epa_site_id) do update
    set company_name = excluded.company_name,
        epa_api_id = excluded.epa_api_id,
        epa_api_key = excluded.epa_api_key,
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

revoke all on function public.complete_transporter_registration(uuid, text, text, text) from public;
grant execute on function public.complete_transporter_registration(uuid, text, text, text) to anon, authenticated;

-- Finally, drop the columns themselves.
alter table public.transporters drop column if exists pin_hash;
alter table public.transporters drop column if exists pin_set_at;
