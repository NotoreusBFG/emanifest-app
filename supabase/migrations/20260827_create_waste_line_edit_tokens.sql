-- Lets an owner invite a delegate to add/edit ONLY a manifest's waste
-- lines via a one-time link — no ManifestMate account needed, same
-- no-account/one-time-token pattern as generator_sign_tokens
-- (20260807_create_generator_sign_tokens.sql), mirrored closely.
--
-- Supersedes the local-draft manifest-prep design (create_manifest_prep_token
-- et al, never applied to any database) — that design had no MTN to attach
-- a real MMIN to. This one requires the manifest to ALREADY exist (the
-- owner creates it first, waste lines optional/empty at that point, real
-- MTN immediately — mirrors how paper manifests get their MTN before the
-- waste details are finalized), so it can reuse the manifest's own MMIN
-- (mmin_encrypted on `manifests`, 20260824_add_mmin_to_manifests.sql)
-- instead of inventing a separate code.
--
-- Verified live against preprod before writing this migration:
-- saveManifest() with wastes: [] succeeds (real MTN, status Scheduled),
-- and updateManifest() on that MTN successfully replaces wastes while
-- leaving generator/transporter/facility untouched.
--
-- Applies DIRECTLY once the MMIN is verified — no separate owner-review
-- step, same trust model as driver-sign/generator-sign (the code IS the
-- approval; nothing is final until the manifest is actually signed later).
--
-- Run this in the Supabase Dashboard -> SQL Editor, or via
-- `npx supabase db push` (CLI now linked — see
-- project memory / apply-migration skill). Depends on
-- 20260824_add_mmin_to_manifests.sql already being applied.

create table if not exists public.waste_line_edit_tokens (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  manifest_epa_mtn text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_phone text,
  recipient_email text,
  -- Snapshotted display fields for the pre-code screen, same reasoning as
  -- generator_sign_tokens' *_snapshot columns — lets the public
  -- /edit-waste-lines/[token] page render context without anon ever
  -- needing read access to `manifests`, and without resolving credentials
  -- (which requires a CLAIMED token, see get_owner_credentials_for_waste_line_token
  -- below) just to show a name.
  generator_name_snapshot text,
  designated_facility_name_snapshot text,
  -- Longer than sign tokens' typical window -- filling in waste lines
  -- takes longer than a quick sign, and this is a one-time invite the
  -- owner sends once (v1: single-use, no resumable multi-session editing
  -- -- if more editing is needed later, the owner sends a new invite).
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz,
  failed_attempt_count integer not null default 0,

  constraint waste_line_edit_tokens_recipient_required
    check (recipient_phone is not null or recipient_email is not null),
  constraint waste_line_edit_tokens_recipient_phone_length
    check (recipient_phone is null or char_length(recipient_phone) < 32),
  constraint waste_line_edit_tokens_recipient_email_length
    check (recipient_email is null or char_length(recipient_email) < 320)
);

create unique index if not exists waste_line_edit_tokens_token_idx on public.waste_line_edit_tokens(token);
create index if not exists waste_line_edit_tokens_owner_id_idx on public.waste_line_edit_tokens(owner_user_id);

alter table public.waste_line_edit_tokens enable row level security;

-- Deliberately no policies -- deny-all, same as generator_sign_tokens/
-- driver_sign_tokens. Every read/write goes through a SECURITY DEFINER
-- function below.

-- Owner-facing: creates a new token. Uses auth.uid() internally so a
-- caller can't spoof another user's id via a parameter.
create or replace function public.create_waste_line_edit_token(
  p_manifest_epa_mtn text,
  p_recipient_phone text,
  p_recipient_email text,
  p_generator_name text,
  p_designated_facility_name text
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
    generator_name_snapshot, designated_facility_name_snapshot
  )
  values (
    p_manifest_epa_mtn, auth.uid(), p_recipient_phone, p_recipient_email,
    p_generator_name, p_designated_facility_name
  )
  returning waste_line_edit_tokens.token into v_token;

  return query select v_token;
end;
$$;

revoke all on function public.create_waste_line_edit_token(text, text, text, text, text) from public;
grant execute on function public.create_waste_line_edit_token(text, text, text, text, text) to authenticated;

-- Anonymous-facing read: display snapshot only (no waste content -- the
-- delegate can't see the live wastes until AFTER the MMIN is verified,
-- since credential resolution below deliberately requires a claimed
-- token). Pure read -- never claims/burns the token.
create or replace function public.get_waste_line_edit_session(p_token uuid)
returns table (
  epa_mtn text,
  generator_name text,
  designated_facility_name text,
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
      t.designated_facility_name_snapshot,
      t.expires_at
    from public.waste_line_edit_tokens t
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now();
end;
$$;

revoke all on function public.get_waste_line_edit_session(uuid) from public;
grant execute on function public.get_waste_line_edit_session(uuid) to anon, authenticated;

-- Anonymous-facing: atomically claims the token BEFORE the MMIN check and
-- the RCRAInfo update call, same double-submit-race reasoning as every
-- other claim_*_token function. failed_attempt_count < 5 caps retries.
create or replace function public.claim_waste_line_edit_token(p_token uuid)
returns table (
  token_id uuid,
  owner_user_id uuid,
  epa_mtn text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    update public.waste_line_edit_tokens t
    set used_at = now()
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now()
      and t.failed_attempt_count < 5
    returning t.id, t.owner_user_id, t.manifest_epa_mtn;
end;
$$;

revoke all on function public.claim_waste_line_edit_token(uuid) from public;
grant execute on function public.claim_waste_line_edit_token(uuid) to anon, authenticated;

-- Anonymous-facing: un-claims a token after a wrong MMIN so the delegate
-- can retry, incrementing failed_attempt_count -- same pattern as every
-- other release_*_token function.
create or replace function public.release_waste_line_edit_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.waste_line_edit_tokens
  set used_at = null,
      failed_attempt_count = failed_attempt_count + 1
  where id = p_token_id;
end;
$$;

revoke all on function public.release_waste_line_edit_token(uuid) from public;
grant execute on function public.release_waste_line_edit_token(uuid) to anon, authenticated;

-- Anonymous-facing: the manifest's MMIN for an ALREADY-CLAIMED token.
-- Mirrors get_mmin_for_claimed_token (20260824_add_mmin_to_manifests.sql)
-- exactly, joined through waste_line_edit_tokens instead of
-- driver_sign_tokens.
create or replace function public.get_mmin_for_claimed_waste_line_token(p_token_id uuid)
returns table (mmin_encrypted text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select m.mmin_encrypted
    from public.waste_line_edit_tokens wlt
    join public.manifests m on m.epa_mtn = wlt.manifest_epa_mtn
    where wlt.id = p_token_id
      and wlt.used_at is not null;
end;
$$;

revoke all on function public.get_mmin_for_claimed_waste_line_token(uuid) from public;
grant execute on function public.get_mmin_for_claimed_waste_line_token(uuid) to anon, authenticated;

-- Anonymous-facing: the owner's encrypted RCRAInfo credentials for an
-- ALREADY-CLAIMED token -- same reasoning as generator_sign_tokens'
-- get_owner_credentials_for_token (20260807): owner_user_id IS
-- auth.users.id for a real account, so keying this on a bare id would let
-- any authenticated caller pull back ANY other user's credentials with no
-- token involved. Keyed on the claimed token id instead. A dedicated
-- function (not a reuse of generator_sign_tokens' version) so this grant
-- stays its own narrowly-scoped, independently reviewable thing.
create or replace function public.get_owner_credentials_for_waste_line_token(p_token_id uuid)
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
    from public.waste_line_edit_tokens t
    join public.user_credentials uc on uc.user_id = t.owner_user_id
    where t.id = p_token_id
      and t.used_at is not null;
end;
$$;

revoke all on function public.get_owner_credentials_for_waste_line_token(uuid) from public;
grant execute on function public.get_owner_credentials_for_waste_line_token(uuid) to anon, authenticated;

-- Audit trail for waste-line-edit attempts, success or failure -- same
-- "always record, either way" discipline as signature_consents, kept as
-- its own table rather than overloading signature_consents since this
-- isn't a signature (no certification text, no printed name required).
create table if not exists public.manifest_edit_consents (
  id uuid primary key default gen_random_uuid(),
  waste_line_edit_token_id uuid references public.waste_line_edit_tokens(id),
  epa_mtn text not null,
  mmin_verified boolean not null default false,
  edit_succeeded boolean not null,
  epa_report_id text,
  epa_error text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.manifest_edit_consents enable row level security;

drop policy if exists "Owners can view edit consents for their tokens" on public.manifest_edit_consents;
create policy "Owners can view edit consents for their tokens"
  on public.manifest_edit_consents for select
  using (
    exists (
      select 1 from public.waste_line_edit_tokens t
      where t.id = manifest_edit_consents.waste_line_edit_token_id
        and t.owner_user_id = auth.uid()
    )
  );

-- Anonymous-facing insert -- anon has no direct write access otherwise.
create or replace function public.record_manifest_edit_consent(
  p_waste_line_edit_token_id uuid,
  p_epa_mtn text,
  p_mmin_verified boolean,
  p_edit_succeeded boolean,
  p_epa_report_id text,
  p_epa_error text,
  p_ip_address text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.manifest_edit_consents (
    waste_line_edit_token_id, epa_mtn, mmin_verified, edit_succeeded,
    epa_report_id, epa_error, ip_address, user_agent
  )
  values (
    p_waste_line_edit_token_id, p_epa_mtn, p_mmin_verified, p_edit_succeeded,
    p_epa_report_id, p_epa_error, p_ip_address, p_user_agent
  );
end;
$$;

revoke all on function public.record_manifest_edit_consent(uuid, text, boolean, boolean, text, text, text, text) from public;
grant execute on function public.record_manifest_edit_consent(uuid, text, boolean, boolean, text, text, text, text) to anon, authenticated;
