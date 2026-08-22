-- Bulk mass-mailer support: tracks per-lead email opt-out so a lead who
-- unsubscribes is never emailed again, and lets the public unsubscribe
-- link work without an admin/auth session.
--
-- unsubscribe_lead_email() follows the same anonymous-facing SECURITY
-- DEFINER pattern as claim_waste_line_edit_token() etc
-- (20260827_create_waste_line_edit_tokens.sql) -- a recipient clicking an
-- unsubscribe link in an email has no admin session, so the
-- leads_admin_all RLS policy (is_admin_caller()) would otherwise block
-- the write. The lead's own uuid id is the "token" here -- unguessable,
-- and the function only ever sets one column, never reads/returns the row.

alter table leads add column if not exists email_unsubscribed_at timestamptz;

create or replace function public.unsubscribe_lead_email(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.leads
  set email_unsubscribed_at = now()
  where id = p_lead_id
    and email_unsubscribed_at is null;
end;
$$;

revoke all on function public.unsubscribe_lead_email(uuid) from public;
grant execute on function public.unsubscribe_lead_email(uuid) to anon, authenticated;
