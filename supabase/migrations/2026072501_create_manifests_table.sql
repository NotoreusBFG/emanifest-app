-- Local mirror of manifests saved to EPA's RCRAInfo system: fast dashboard
-- listing without repeated live API calls, and the anchor table LDR notices
-- will reference once that feature is built. Not a true pre-EPA draft store
-- yet -- every row here corresponds to a manifest that has already been
-- saved via POST /emanifest/manifest/save, since that's what the app
-- actually does today (see docs/NEXT_SESSION.md's note on "Save as draft"
-- not yet being a real local-only draft).
--
-- Run this in the Supabase Dashboard -> SQL Editor (or via `supabase db
-- push` once the CLI is linked to the project) -- same as
-- 20260723_create_user_credentials.sql.

create table if not exists public.manifests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- EPA-assigned tracking number -- always present today (see note above).
  epa_mtn text not null unique,
  epa_status text,

  -- Denormalized for fast dashboard listing without a live getManifest()
  -- call per row.
  generator_name text,
  generator_epa_site_id text,
  designated_facility_name text,
  designated_facility_epa_site_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now()
);

create index if not exists manifests_user_id_idx on public.manifests(user_id);

alter table public.manifests enable row level security;

drop policy if exists "Users can view their own manifests" on public.manifests;
create policy "Users can view their own manifests"
  on public.manifests for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own manifests" on public.manifests;
create policy "Users can insert their own manifests"
  on public.manifests for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own manifests" on public.manifests;
create policy "Users can update their own manifests"
  on public.manifests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own manifests" on public.manifests;
create policy "Users can delete their own manifests"
  on public.manifests for delete
  using (auth.uid() = user_id);

-- Keep updated_at fresh on every row change.
create or replace function public.set_manifests_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists manifests_set_updated_at on public.manifests;
create trigger manifests_set_updated_at
  before update on public.manifests
  for each row execute function public.set_manifests_updated_at();
