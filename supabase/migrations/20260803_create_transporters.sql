-- Third-party transporter companies whose RCRAInfo API credentials
-- ManifestMate holds, so a generator can trigger a real electronic
-- signature for them via the SMS-to-driver flow (see plan.md /
-- driverSignActions.ts). Phase 1 of that feature: rows here are inserted
-- by an admin running scripts/add-transporter-credentials.ts locally --
-- there's no self-serve registration UI yet (deliberately deferred to a
-- later phase).
--
-- Unlike every other credentials table in this app (user_credentials),
-- the owner of these credentials is NOT a Supabase Auth user -- no one at
-- the transporter ever logs into ManifestMate, so there's no auth.users
-- row to key off. RLS is enabled with ZERO policies (deny-all for both
-- anon and authenticated): nothing in the app UI reads or writes this
-- table directly. All access goes through the SECURITY DEFINER function
-- below (generator-facing lookup, never exposes credentials) and the
-- additional ones in 20260804_create_driver_sign_tokens.sql (the actual
-- credential fetch for signing).
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder.

create table if not exists public.transporters (
  id uuid primary key default gen_random_uuid(),
  epa_site_id text not null unique,
  company_name text not null,
  -- Encrypted with the same src/lib/cryptoUtils.ts helper user_credentials
  -- already uses (AES-256-CBC, ENCRYPTION_SECRET_KEY) -- app-level
  -- encryption, not pgcrypto, for consistency with the rest of this app.
  epa_api_id text not null,
  epa_api_key text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.transporters enable row level security;

-- Deliberately no policies here -- see comment above.

-- Lets a logged-in generator check "is this transporter already set up
-- for SMS signing" and get the internal id needed to create a
-- driver_sign_tokens row, WITHOUT ever exposing epa_api_id/epa_api_key to
-- the client. security definer + a pinned search_path (required for any
-- SECURITY DEFINER function -- an unpinned one is a classic
-- privilege-escalation vector via a malicious search_path).
create or replace function public.get_transporter_for_generator(p_epa_site_id text)
returns table (id uuid, company_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select t.id, t.company_name
    from public.transporters t
    where t.epa_site_id = p_epa_site_id
      and t.revoked_at is null;
end;
$$;

revoke all on function public.get_transporter_for_generator(text) from public;
grant execute on function public.get_transporter_for_generator(text) to authenticated;
