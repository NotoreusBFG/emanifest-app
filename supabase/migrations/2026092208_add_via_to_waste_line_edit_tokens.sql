-- Lets a "Text to scan" invite (SendForSignature.tsx's TextToScanPanel)
-- render a compact, scan-only page instead of the full desktop-style
-- waste-line-edit form -- the same distinction createWasteLineEditLinkAction's
-- messageVariant already makes for the SMS/email copy, now persisted on
-- the token itself so the anonymous page knows which UI to show.
--
-- Also has get_waste_line_edit_session return the designated facility's
-- EPA ID (from the local `manifests` mirror, not a live RCRAInfo call --
-- same reasoning as 2026092207) pre-claim, so the compact scan page can
-- let the delegate start scanning immediately without a separate Unlock
-- step -- the EPA ID is no more sensitive than the facility NAME already
-- exposed pre-claim, it's just an identifier.
--
-- Rebuilds create_waste_line_edit_token/get_waste_line_edit_session on top
-- of their CURRENT shape from 20260830_add_sign_authority_to_waste_line_edit.sql
-- (owner_notify_email + allow_sign) -- both preserved unchanged below,
-- `via` is purely additive.
alter table public.waste_line_edit_tokens
  add column if not exists via text not null default 'manual';

alter table public.waste_line_edit_tokens drop constraint if exists waste_line_edit_tokens_via_check;
alter table public.waste_line_edit_tokens
  add constraint waste_line_edit_tokens_via_check check (via in ('manual', 'scan'));

-- Parameter-list change -- DROP needed first.
drop function if exists public.create_waste_line_edit_token(text, text, text, text, text, text, boolean);

create or replace function public.create_waste_line_edit_token(
  p_manifest_epa_mtn text,
  p_recipient_phone text,
  p_recipient_email text,
  p_generator_name text,
  p_designated_facility_name text,
  p_owner_notify_email text,
  p_allow_sign boolean,
  p_via text default 'manual'
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
    raise exception 'Must be logged in to create a waste-line-edit link';
  end if;

  insert into public.waste_line_edit_tokens (
    manifest_epa_mtn, owner_user_id, recipient_phone, recipient_email,
    generator_name_snapshot, designated_facility_name_snapshot, owner_notify_email,
    allow_sign, via
  )
  values (
    p_manifest_epa_mtn, auth.uid(), p_recipient_phone, p_recipient_email,
    p_generator_name, p_designated_facility_name, p_owner_notify_email,
    p_allow_sign, coalesce(p_via, 'manual')
  )
  returning waste_line_edit_tokens.token into v_token;

  return query select v_token;
end;
$$;

revoke all on function public.create_waste_line_edit_token(text, text, text, text, text, text, boolean, text) from public;
grant execute on function public.create_waste_line_edit_token(text, text, text, text, text, text, boolean, text) to authenticated;

-- Return-shape change -- DROP needed first.
drop function if exists public.get_waste_line_edit_session(uuid);

create or replace function public.get_waste_line_edit_session(p_token uuid)
returns table (
  epa_mtn text,
  generator_name text,
  designated_facility_name text,
  expires_at timestamptz,
  allow_sign boolean,
  designated_facility_epa_site_id text,
  via text
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
      t.designated_facility_name_snapshot,
      t.expires_at,
      t.allow_sign,
      m.designated_facility_epa_site_id,
      t.via
    from public.waste_line_edit_tokens t
    left join public.manifests m
      on m.user_id = t.owner_user_id
      and m.epa_mtn = t.manifest_epa_mtn
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now();
end;
$$;

revoke all on function public.get_waste_line_edit_session(uuid) from public;
grant execute on function public.get_waste_line_edit_session(uuid) to anon, authenticated;
