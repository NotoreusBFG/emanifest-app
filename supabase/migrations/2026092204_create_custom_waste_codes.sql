-- Per-account custom chemical/waste-code library ("build the database as
-- we go") -- lets a user manually save a chemical + RCRA code(s) they
-- looked up (or already knew) into their own personal list, so the next
-- search for that chemical is an instant local match instead of another
-- EPA/PubChem round trip. Deliberately private per account, not shared
-- across all ManifestMate customers -- one user's typo or wrong code
-- should never silently affect another paying customer's hazmat
-- determination, matching how every other piece of data in this app
-- (waste profiles, lab packs, etc.) is owner-scoped.

create table public.custom_waste_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  chemical_name text not null check (chemical_name <> ''),
  -- Generated, not app-supplied -- PostgREST upsert's onConflict target
  -- must name real plain columns, and a unique index on a bare lower()
  -- expression (rather than a stored column) won't match that target.
  chemical_name_key text generated always as (lower(chemical_name)) stored,

  f_codes text[] not null default '{}',
  u_codes text[] not null default '{}',
  p_codes text[] not null default '{}',
  d_codes text[] not null default '{}',

  notes text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One entry per chemical name per user -- saving the same name again
-- updates the existing row (upsert) rather than creating a duplicate
-- that would show up twice in search results.
create unique index custom_waste_codes_user_name_idx
  on public.custom_waste_codes(user_id, chemical_name_key);

alter table public.custom_waste_codes enable row level security;

create policy "custom_waste_codes_select_own" on public.custom_waste_codes
  for select using (auth.uid() = user_id);
create policy "custom_waste_codes_insert_own" on public.custom_waste_codes
  for insert with check (auth.uid() = user_id);
create policy "custom_waste_codes_update_own" on public.custom_waste_codes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_waste_codes_delete_own" on public.custom_waste_codes
  for delete using (auth.uid() = user_id);
