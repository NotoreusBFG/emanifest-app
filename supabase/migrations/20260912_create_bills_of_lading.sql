-- Bills of lading for non-hazardous waste shipments -- these never touch
-- RCRAInfo (no EPA involvement at all for a non-RCRA waste stream), so
-- unlike every manifest table in this schema, this one is the sole
-- source of truth, not a local mirror of something EPA already has.
-- Layout follows a standard domestic Straight Bill of Lading (shipper /
-- consignee / carrier blocks, a line-item table, special instructions,
-- hand-signed at pickup/delivery -- no e-signature workflow, see the
-- 2026-09-04 design decision) rather than mimicking the Uniform
-- Hazardous Waste Manifest's numbered-box layout, since that layout is
-- EPA's own PDF and was never something this app renders itself.

create sequence if not exists bill_of_lading_number_seq;

create table if not exists bills_of_lading (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Human-readable reference number ("BOL-000001", ...), same convention
  -- as waste_profiles.mm_profile_number -- there's no EPA-assigned
  -- tracking number to use instead, since this never goes to RCRAInfo.
  bol_number text not null unique
    default ('BOL-' || lpad(nextval('bill_of_lading_number_seq')::text, 6, '0')),

  ship_date date not null default current_date,

  shipper_name text not null default '',
  shipper_address text not null default '',
  shipper_city text not null default '',
  shipper_state text not null default '',
  shipper_zip text not null default '',
  shipper_contact_name text not null default '',
  shipper_contact_phone text not null default '',

  consignee_name text not null default '',
  consignee_address text not null default '',
  consignee_city text not null default '',
  consignee_state text not null default '',
  consignee_zip text not null default '',
  consignee_contact_name text not null default '',
  consignee_contact_phone text not null default '',

  carrier_name text not null default '',
  carrier_contact_name text not null default '',
  carrier_contact_phone text not null default '',

  special_instructions text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bills_of_lading_user_id_idx on bills_of_lading(user_id);

alter table bills_of_lading enable row level security;

create policy "bills_of_lading_select_own" on bills_of_lading
  for select using (auth.uid() = user_id);

create policy "bills_of_lading_insert_own" on bills_of_lading
  for insert with check (auth.uid() = user_id);

create policy "bills_of_lading_update_own" on bills_of_lading
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bills_of_lading_delete_own" on bills_of_lading
  for delete using (auth.uid() = user_id);

-- Line items -- deliberately a real child table (not JSONB) so a line can
-- reference the waste profile it was loaded from, same shape every other
-- repeating-row concept in this schema uses.
create table if not exists bill_of_lading_lines (
  id uuid primary key default gen_random_uuid(),
  bill_of_lading_id uuid not null references bills_of_lading(id) on delete cascade,
  line_number integer not null,

  -- Which saved profile this line was loaded from, if any -- set null
  -- (not cascaded) if the profile is later deleted, so the line survives
  -- with whatever text it already has.
  waste_profile_id uuid references waste_profiles(id) on delete set null,

  description text not null default '',
  quantity numeric not null default 0,
  unit_code text not null default '',
  container_number integer not null default 0,
  container_type_code text not null default '',
  special_instructions text not null default ''
);

create index if not exists bill_of_lading_lines_bol_id_idx on bill_of_lading_lines(bill_of_lading_id);

alter table bill_of_lading_lines enable row level security;

-- Scoped via the parent bill of lading's owner, same pattern as
-- manifest_transporters (this table has no user_id column of its own).
create policy "bill_of_lading_lines_select_own" on bill_of_lading_lines
  for select using (exists (
    select 1 from bills_of_lading b
    where b.id = bill_of_lading_lines.bill_of_lading_id and b.user_id = auth.uid()
  ));

create policy "bill_of_lading_lines_insert_own" on bill_of_lading_lines
  for insert with check (exists (
    select 1 from bills_of_lading b
    where b.id = bill_of_lading_lines.bill_of_lading_id and b.user_id = auth.uid()
  ));

create policy "bill_of_lading_lines_update_own" on bill_of_lading_lines
  for update using (exists (
    select 1 from bills_of_lading b
    where b.id = bill_of_lading_lines.bill_of_lading_id and b.user_id = auth.uid()
  )) with check (exists (
    select 1 from bills_of_lading b
    where b.id = bill_of_lading_lines.bill_of_lading_id and b.user_id = auth.uid()
  ));

create policy "bill_of_lading_lines_delete_own" on bill_of_lading_lines
  for delete using (exists (
    select 1 from bills_of_lading b
    where b.id = bill_of_lading_lines.bill_of_lading_id and b.user_id = auth.uid()
  ));
