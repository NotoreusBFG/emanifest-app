-- BUG FIX, found live-testing 2026-08-03: create_transporter_registration_token
-- was a plain INSERT, which collides with
-- transporter_registration_tokens_one_pending_per_site_idx (the partial
-- unique index added in 20260811 specifically to stop duplicate
-- outstanding invites for the same site) the moment a generator tries to
-- resend an invite -- e.g. the email attempt didn't arrive (Resend
-- misconfigured locally) and they retry via SMS, hitting "duplicate key
-- value violates unique constraint" instead of actually resending.
--
-- Fix: make the insert idempotent per pending-site via
-- ON CONFLICT (epa_site_id) WHERE used_at IS NULL -- Postgres can target a
-- partial unique index this way as long as the predicate matches exactly,
-- which it does here. On a resend, this UPDATEs the existing still-pending
-- row (merging in whichever new contact channel was provided this time,
-- keeping the old one via COALESCE rather than discarding it; refreshing
-- expires_at and failed_attempt_count so a resend gets a fresh window) and
-- RETURNING gives back the SAME token, since the token column itself isn't
-- touched by the update -- the generator's new send just reuses the
-- existing link rather than creating a second, orphaned one.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260811_create_transporter_registration_tokens.sql already being
-- applied.

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
        manifest_epa_mtn = excluded.manifest_epa_mtn,
        owner_notify_email = excluded.owner_notify_email,
        expires_at = now() + interval '14 days',
        failed_attempt_count = 0
  returning transporter_registration_tokens.token into v_token;

  return query select v_token;
end;
$$;

revoke all on function public.create_transporter_registration_token(text, text, text, text, text, text) from public;
grant execute on function public.create_transporter_registration_token(text, text, text, text, text, text) to authenticated;
