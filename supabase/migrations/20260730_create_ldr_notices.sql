-- Land Disposal Restriction (LDR) notices -- 40 CFR 268.7(a). See
-- "ldr schema.md" at the repo root for the full regulatory research this
-- is based on. EPA's e-Manifest system does NOT process these (confirmed
-- via EPA's own FAQ), so this is a fully separate ManifestMate-only
-- record -- never submitted through RcrainfoClient.
--
-- Modeled as a STANDING record per (generator, waste stream, receiving
-- facility), not a per-shipment form -- 268.7(a)(2)/(a)(3) only requires a
-- new notice when the waste or the receiving facility changes, not on
-- every manifest. `waste_code_key` is a sorted, comma-joined string of the
-- EPA hazardous waste codes on this notice, used as the practical
-- "is this the same waste stream" comparison key (a reasonable proxy given
-- code-level data is what this app actually has -- not a substitute for a
-- generator's own determination that their waste hasn't materially
-- changed). `superseded_at` marks a notice inactive once a newer one
-- replaces it for the same generator/facility/waste-code combination.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as every other
-- migration in this folder.

create table if not exists public.ldr_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Nullable: an LDR notice can exist independent of any specific
  -- manifest (it's a standing record, not a per-shipment form), and the
  -- first shipment referencing it may not have an MTN yet. `epa_mtn` (not
  -- the FK) is the durable link if the local manifests row is later
  -- deleted -- same pattern as signature_consents.
  manifest_id uuid references public.manifests(id) on delete set null,
  epa_mtn text,

  generator_epa_site_id text not null,
  receiving_facility_epa_site_id text not null,
  receiving_facility_name text not null,

  -- Path A (40 CFR 268.7(a)(2)): waste needs treatment before it meets the
  -- standard -- notice only, no certification at this stage.
  -- Path B (40 CFR 268.7(a)(3)): waste already meets the standard as
  -- generated -- notice PLUS a signed certification statement.
  path text not null check (path in ('notice_only', 'notice_and_certification')),

  -- Array of LdrWasteLineEntry (see src/lib/ldr/types.ts) -- EPA waste
  -- codes, constituents of concern, wastewater category, etc.
  waste_lines jsonb not null,
  -- Sorted, comma-joined waste codes across waste_lines -- see note above.
  waste_code_key text not null,

  prepared_date date not null default current_date,

  -- Path B only. certification_text is snapshotted verbatim at signing
  -- time (not a reference to "whatever the current constant is"), same
  -- reasoning as signature_consents.certification_text.
  certification_signed_by_name text,
  certification_signed_at timestamptz,
  certification_text text,

  superseded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ldr_notices_certification_required_for_path_b check (
    path = 'notice_only' or (certification_signed_by_name is not null and certification_signed_at is not null)
  )
);

create index if not exists ldr_notices_user_id_idx on public.ldr_notices(user_id);
-- Backs "do we already have an active notice on file" lookups.
create index if not exists ldr_notices_active_lookup_idx
  on public.ldr_notices(user_id, generator_epa_site_id, receiving_facility_epa_site_id, waste_code_key)
  where superseded_at is null;

alter table public.ldr_notices enable row level security;

drop policy if exists "Users can view their own LDR notices" on public.ldr_notices;
create policy "Users can view their own LDR notices"
  on public.ldr_notices for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own LDR notices" on public.ldr_notices;
create policy "Users can insert their own LDR notices"
  on public.ldr_notices for insert
  with check (auth.uid() = user_id);

-- Update is only ever used to set superseded_at on an existing row (see
-- ldrRepository.ts) -- notices otherwise aren't editable after creation,
-- same "audit trail, not a mutable form" reasoning as signature_consents.
drop policy if exists "Users can supersede their own LDR notices" on public.ldr_notices;
create policy "Users can supersede their own LDR notices"
  on public.ldr_notices for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
