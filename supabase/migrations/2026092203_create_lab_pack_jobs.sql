-- Lab pack phase 2: job/batch grouping (see private-notes NEXT_SESSION.md
-- and the approved plan for full context). A `lab_pack_jobs` row is one
-- batch of drums prepped for one generator before any manifest/MTN exists
-- -- the third-party lab-pack workflow's internal reference number.
-- `job_number` ("LP-000001", ...) is ManifestMate's own auto-generated
-- sequence, same default-expression pattern as
-- waste_profiles.mm_profile_number -- NOT to be confused with
-- lab_packs.job_number (free text, already exists), which is the third
-- party's own PO/work-order number, an unrelated external reference.

create sequence if not exists lab_pack_job_number_seq;

create table if not exists public.lab_pack_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  job_number text not null unique
    default ('LP-' || lpad(nextval('lab_pack_job_number_seq')::text, 6, '0')),
  job_name text not null default '',

  generator_epa_id text not null default '',
  generator_name text not null default '',
  generator_address text not null default '',

  status text not null default 'open' check (status in ('open', 'ready', 'linked', 'archived')),
  epa_mtn text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lab_pack_jobs_user_id_idx on public.lab_pack_jobs(user_id);
create index if not exists lab_pack_jobs_generator_idx on public.lab_pack_jobs(user_id, generator_epa_id);

alter table public.lab_pack_jobs enable row level security;

create policy "lab_pack_jobs_select_own" on public.lab_pack_jobs
  for select using (auth.uid() = user_id);
create policy "lab_pack_jobs_insert_own" on public.lab_pack_jobs
  for insert with check (auth.uid() = user_id);
create policy "lab_pack_jobs_update_own" on public.lab_pack_jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lab_pack_jobs_delete_own" on public.lab_pack_jobs
  for delete using (auth.uid() = user_id);

-- Nullable: phase-1 drums created before this table existed (and any
-- future non-hazardous one-off) stay valid with no job. `on delete set
-- null` (not cascade) -- deleting a job detaches its drums into the
-- "legacy / ungrouped" bucket rather than destroying real packing data.
alter table public.lab_packs
  add column if not exists job_id uuid references public.lab_pack_jobs(id) on delete set null;

create index if not exists lab_packs_job_id_idx on public.lab_packs(job_id) where job_id is not null;
