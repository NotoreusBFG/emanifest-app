-- Wastewater/nonwastewater category per manifest waste line -- a
-- ManifestMate-only concept (RCRAInfo's manifest schema has no field for
-- this at all; it's purely an LDR notice requirement, 40 CFR 268.40).
-- Captured at manifest-creation time so it's known and accurate later when
-- an LDR notice gets filed for that manifest, instead of the LDR form
-- silently guessing "nonwastewater" for every line.
--
-- Keyed by (user_id, epa_mtn, line_number) rather than a manifests_id FK --
-- same "epa_mtn is the durable link" reasoning as signature_consents and
-- ldr_notices, so this survives even if the local manifests mirror row is
-- ever deleted/recreated.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as every other
-- migration in this folder.

create table if not exists public.manifest_waste_line_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  epa_mtn text not null,
  line_number integer not null,
  wastewater_category text not null check (wastewater_category in ('wastewater', 'nonwastewater')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, epa_mtn, line_number)
);

create index if not exists manifest_waste_line_metadata_lookup_idx
  on public.manifest_waste_line_metadata(user_id, epa_mtn);

alter table public.manifest_waste_line_metadata enable row level security;

drop policy if exists "Users can view their own waste line metadata" on public.manifest_waste_line_metadata;
create policy "Users can view their own waste line metadata"
  on public.manifest_waste_line_metadata for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own waste line metadata" on public.manifest_waste_line_metadata;
create policy "Users can insert their own waste line metadata"
  on public.manifest_waste_line_metadata for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own waste line metadata" on public.manifest_waste_line_metadata;
create policy "Users can update their own waste line metadata"
  on public.manifest_waste_line_metadata for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
