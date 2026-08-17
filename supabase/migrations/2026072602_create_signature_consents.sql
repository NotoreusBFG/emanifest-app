-- Audit trail for the sign confirmation dialog ("signing your life away"
-- clickwrap) -- one row per confirmed sign attempt, success or failure.
-- Not a substitute for EPA's own CROMERR "copy of record" (the
-- electronicSignaturesInfo bundle RCRAInfo creates on a successful
-- quicker-sign call, tied to the calling account's credentials) -- this is
-- ManifestMate's own independent record of who was actually shown what
-- certification text and affirmatively agreed, before the system acted on
-- their behalf. Matters most once delegated Quick-Sign exists (see
-- docs/delegate-quick-sign-design.md), since EPA's own record only ever
-- shows the credential owner, never the actual person who triggered the
-- call -- but valuable from day one as proof of informed consent and a
-- real accountability/marketing differentiator regardless.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on the `manifests` table already
-- existing (2026072501_create_manifests_table.sql).

create table if not exists public.signature_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Nullable: a local manifests row should normally already exist by sign
  -- time, but this table's real link is epa_mtn (always known), not this
  -- FK, so a missing local row doesn't block recording consent.
  manifest_id uuid references public.manifests(id) on delete set null,
  epa_mtn text not null,
  site_type text not null,
  transporter_order integer,
  site_id text not null,
  printed_signature_name text not null,

  -- Snapshotted verbatim, not a reference to "whatever the current text
  -- is" -- EPA's own form language can change over time, and the whole
  -- point is proof of what was actually shown on this specific date.
  certification_heading text not null,
  certification_text text not null,
  certification_is_verbatim boolean not null,

  ip_address text,
  user_agent text,
  acknowledged_at timestamptz not null default now(),

  -- Outcome of the EPA sign call this consent led to.
  sign_succeeded boolean not null,
  epa_report_id text,
  epa_error text
);

create index if not exists signature_consents_user_id_idx on public.signature_consents(user_id);
create index if not exists signature_consents_epa_mtn_idx on public.signature_consents(epa_mtn);

alter table public.signature_consents enable row level security;

drop policy if exists "Users can view their own signature consents" on public.signature_consents;
create policy "Users can view their own signature consents"
  on public.signature_consents for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own signature consents" on public.signature_consents;
create policy "Users can insert their own signature consents"
  on public.signature_consents for insert
  with check (auth.uid() = user_id);

-- Deliberately no update/delete policies -- this is an audit trail, not a
-- record anyone (including the user it belongs to) should be able to
-- retroactively edit or remove.
