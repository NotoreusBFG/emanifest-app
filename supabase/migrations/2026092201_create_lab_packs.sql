-- Lab pack packing lists (phase 1 -- manual entry, see
-- private-notes for the full feature scope). One `lab_packs` row is one
-- outer drum/container; `lab_pack_line_items` are the individual chemical
-- containers packed inside it. Mirrors the DOT lab-pack packaging exception
-- (49 CFR 173.12(b)) and a real vendor lab-pack inventory sheet's field
-- shape: DOT shipping description, hazard info, waste codes, and outer
-- container info are set once per drum (this table), not per chemical --
-- each line item just carries its own name/quantity/size/state/waste codes.
--
-- Generator association mirrors waste_profiles' generator_epa_id/name/
-- address columns (20260916_add_generator_to_waste_profiles.sql) so this
-- table slots into the same "Site:" filter (SiteFilterButtons) used on
-- dashboard/LDR/profiles/BOL.
--
-- `epa_mtn`/`manifest_line_number` are set once this pack is linked to a
-- real manifest waste line (see 2026092202_link_lab_pack_to_waste_line_metadata.sql
-- and linkLabPackToManifestLineAction) -- null until then, same "durable
-- link via epa_mtn" convention used by manifest_waste_line_metadata.

create table public.lab_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  job_number text not null default '',

  generator_epa_id text not null default '',
  generator_name text not null default '',
  generator_address text not null default '',

  is_non_hazardous boolean not null default false,
  dot_shipping_description text not null default '',
  dot_special_permit_number text not null default '',
  rq_indicator boolean not null default false,
  rq_codes text not null default '',
  waste_codes text[] not null default '{}',
  total_weight numeric,

  outer_container_type_code text not null default 'DM',
  outer_container_size text not null default '',
  drum_number integer,

  epa_mtn text,
  manifest_line_number integer,

  status text not null default 'draft' check (status in ('draft', 'finalized')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lab_packs_user_id_idx on public.lab_packs(user_id);
create index lab_packs_epa_mtn_idx on public.lab_packs(epa_mtn) where epa_mtn is not null;

alter table public.lab_packs enable row level security;

create policy "lab_packs_select_own" on public.lab_packs
  for select using (auth.uid() = user_id);
create policy "lab_packs_insert_own" on public.lab_packs
  for insert with check (auth.uid() = user_id);
create policy "lab_packs_update_own" on public.lab_packs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lab_packs_delete_own" on public.lab_packs
  for delete using (auth.uid() = user_id);

create table public.lab_pack_line_items (
  id uuid primary key default gen_random_uuid(),
  lab_pack_id uuid not null references public.lab_packs(id) on delete cascade,

  line_number integer not null,
  chemical_name text not null check (chemical_name <> ''),
  quantity integer,
  container_size text not null default '',
  physical_state text check (physical_state in ('liquid', 'solid', 'gas')),
  epa_waste_codes text[] not null default '{}',
  source_location text not null default '',
  notes text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lab_pack_line_items_lab_pack_id_idx on public.lab_pack_line_items(lab_pack_id);

alter table public.lab_pack_line_items enable row level security;

-- No direct user_id on line items -- ownership is via the parent lab_packs
-- row, same "child table scoped by a join" shape RLS supports natively.
create policy "lab_pack_line_items_select_own" on public.lab_pack_line_items
  for select using (
    exists (select 1 from public.lab_packs lp where lp.id = lab_pack_id and lp.user_id = auth.uid())
  );
create policy "lab_pack_line_items_insert_own" on public.lab_pack_line_items
  for insert with check (
    exists (select 1 from public.lab_packs lp where lp.id = lab_pack_id and lp.user_id = auth.uid())
  );
create policy "lab_pack_line_items_update_own" on public.lab_pack_line_items
  for update using (
    exists (select 1 from public.lab_packs lp where lp.id = lab_pack_id and lp.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.lab_packs lp where lp.id = lab_pack_id and lp.user_id = auth.uid())
  );
create policy "lab_pack_line_items_delete_own" on public.lab_pack_line_items
  for delete using (
    exists (select 1 from public.lab_packs lp where lp.id = lab_pack_id and lp.user_id = auth.uid())
  );
