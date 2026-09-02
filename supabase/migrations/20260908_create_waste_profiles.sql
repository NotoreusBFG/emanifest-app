-- Waste Profile library (suggested by Vince Sheerer, president of
-- environmental services at Republic Services, 2026-09-02 meeting) -- lets
-- a generator save a reusable waste-stream description once and load it
-- onto a new manifest's waste line instead of retyping every field.
--
-- Deliberately NOT a full TSDF-side waste profile -- it only stores the
-- fields ManifestMate's own waste-line form already has (see
-- WasteLineFormState in ManifestFieldsForm.tsx), minus anything that
-- varies shipment to shipment (quantity, container count). The one thing
-- added beyond that shape is which disposal facility approved this waste
-- stream, so the app can refuse to load a profile onto a manifest bound
-- for a different facility (see the two `<> ''` checks and the app-side
-- match check in ManifestFieldsForm.tsx's applyWasteProfile).

create sequence if not exists waste_profile_number_seq;

create table if not exists waste_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Human-readable unique identifier ("MM-000001", ...), distinct from the
  -- uuid primary key -- shown to the user. The sequence never rewinds, so
  -- a number is never reused even after the profile that had it is deleted.
  mm_profile_number text not null unique
    default ('MM-' || lpad(nextval('waste_profile_number_seq')::text, 6, '0')),

  profile_name text not null check (profile_name <> ''),

  dot_hazardous boolean not null default true,
  is_rcra_waste boolean not null default true,
  proper_shipping_name text not null default '',
  rq_indicator boolean not null default false,
  hazard_class text not null default '',
  packing_group text not null default '',
  id_number_code text not null default '',
  federal_waste_code text not null default '',
  wastewater_category text not null default 'nonwastewater'
    check (wastewater_category in ('wastewater', 'nonwastewater')),
  is_lab_pack boolean not null default false,
  waste_description text not null default '',
  default_unit_code text not null default '',
  default_container_type_code text not null default '',

  disposal_facility_name text not null default '',
  -- Required (not just app-side) -- this is the field the load-a-profile
  -- match check compares against the manifest's designated facility, so a
  -- profile can never exist without one to check against.
  disposal_facility_epa_id text not null check (disposal_facility_epa_id <> ''),
  disposal_facility_profile_number text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists waste_profiles_user_id_idx on waste_profiles(user_id);

alter table waste_profiles enable row level security;

create policy "waste_profiles_select_own" on waste_profiles
  for select using (auth.uid() = user_id);

create policy "waste_profiles_insert_own" on waste_profiles
  for insert with check (auth.uid() = user_id);

create policy "waste_profiles_update_own" on waste_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "waste_profiles_delete_own" on waste_profiles
  for delete using (auth.uid() = user_id);
