-- Physical state + hazard-property characteristics for a waste profile --
-- content from the printable-label design (2026-09-04). These describe the
-- waste stream itself, so they belong on the reusable profile, not on a
-- single print.
alter table waste_profiles
  add column if not exists physical_state text
    check (physical_state in ('solid', 'liquid', 'sludge', 'gas')),
  add column if not exists is_ignitable boolean not null default false,
  add column if not exists is_corrosive boolean not null default false,
  add column if not exists is_reactive boolean not null default false,
  add column if not exists is_toxic boolean not null default false;

-- Each container label actually printed -- a point-in-time snapshot of the
-- owning profile plus print-specific fields (accumulation start date,
-- line/container reference, optional manifest tracking number, generator
-- info), so a regulator reading a drum months later sees exactly what was
-- on the label when it was printed, not whatever the profile has been
-- edited to say since. The QR code on the printed label encodes a public
-- URL to /labels/{id} for this row -- deliberately no login required,
-- since whoever's reading a drum in the field won't have a ManifestMate
-- account.
create table if not exists label_prints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  waste_profile_id uuid references waste_profiles(id) on delete set null,

  -- Snapshot of the profile at print time.
  mm_profile_number text not null,
  profile_name text not null,
  proper_shipping_name text not null default '',
  waste_description text not null default '',
  dot_hazardous boolean not null default true,
  is_rcra_waste boolean not null default true,
  hazard_class text not null default '',
  packing_group text not null default '',
  id_number_code text not null default '',
  federal_waste_code text not null default '',
  physical_state text,
  is_ignitable boolean not null default false,
  is_corrosive boolean not null default false,
  is_reactive boolean not null default false,
  is_toxic boolean not null default false,
  disposal_facility_name text not null default '',
  disposal_facility_epa_id text not null default '',
  disposal_facility_profile_number text not null default '',

  -- Print-specific, entered by whoever printed this particular label.
  generator_name text not null default '',
  generator_address text not null default '',
  generator_epa_id text not null default '',
  manifest_tracking_number text not null default '',
  line_reference text not null default '',
  accumulation_start_date date not null,

  created_at timestamptz not null default now()
);

create index if not exists label_prints_user_id_idx on label_prints(user_id);
create index if not exists label_prints_waste_profile_id_idx on label_prints(waste_profile_id);

alter table label_prints enable row level security;

create policy "label_prints_insert_own" on label_prints
  for insert with check (auth.uid() = user_id);

create policy "label_prints_delete_own" on label_prints
  for delete using (auth.uid() = user_id);

-- Deliberately public, not owner-scoped -- this is the whole point of the
-- QR code. Everything a public request can select here is already printed
-- on the physical label; application code additionally never selects
-- user_id for the public-facing page even though RLS itself doesn't hide
-- individual columns.
create policy "label_prints_select_public" on label_prints
  for select using (true);
