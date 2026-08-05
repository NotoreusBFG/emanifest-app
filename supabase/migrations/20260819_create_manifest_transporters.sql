-- Persists which transporter EPA Site ID(s) are on which manifest -- the
-- data has always existed only transiently in memory (RCRAInfo's
-- getManifest() response, manifest.transporters: Handler[]) and is
-- currently just flattened into manifests.transporter_names (a display
-- string, not queryable/joinable). This table is what the transporter
-- dashboard (20260820) actually joins against.
--
-- Non-sensitive, generator-owned business data (an EPA Site ID + a leg
-- order, same sensitivity level as the transporter_names column already
-- sitting in plain manifests) -- so this follows manifests' OWN existing
-- owner-scoped RLS-policy pattern, not the deny-all + RPC pattern used
-- for transporters/driver_sign_tokens (that pattern is reserved for
-- actual credentials/PINs/tokens). Cross-owner reads for the transporter
-- dashboard still go through a SECURITY DEFINER function, same as every
-- other cross-ownership-boundary read in this schema.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder.

create table if not exists public.manifest_transporters (
  manifest_id uuid not null references public.manifests(id) on delete cascade,
  transporter_epa_site_id text not null,
  transporter_order int not null default 1,
  transporter_name text,
  updated_at timestamptz not null default now(),
  primary key (manifest_id, transporter_epa_site_id)
);

create index if not exists manifest_transporters_epa_site_id_idx
  on public.manifest_transporters(transporter_epa_site_id);

alter table public.manifest_transporters enable row level security;

-- Mirrors manifests' own policies exactly, scoped via the parent
-- manifest's owner rather than a direct user_id column (this table has
-- none -- manifest_id is the only FK).
drop policy if exists "Users can view their manifest's transporters" on public.manifest_transporters;
create policy "Users can view their manifest's transporters"
  on public.manifest_transporters for select
  using (exists (
    select 1 from public.manifests m
    where m.id = manifest_transporters.manifest_id and m.user_id = auth.uid()
  ));

drop policy if exists "Users can insert their manifest's transporters" on public.manifest_transporters;
create policy "Users can insert their manifest's transporters"
  on public.manifest_transporters for insert
  with check (exists (
    select 1 from public.manifests m
    where m.id = manifest_transporters.manifest_id and m.user_id = auth.uid()
  ));

drop policy if exists "Users can update their manifest's transporters" on public.manifest_transporters;
create policy "Users can update their manifest's transporters"
  on public.manifest_transporters for update
  using (exists (
    select 1 from public.manifests m
    where m.id = manifest_transporters.manifest_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.manifests m
    where m.id = manifest_transporters.manifest_id and m.user_id = auth.uid()
  ));

drop policy if exists "Users can delete their manifest's transporters" on public.manifest_transporters;
create policy "Users can delete their manifest's transporters"
  on public.manifest_transporters for delete
  using (exists (
    select 1 from public.manifests m
    where m.id = manifest_transporters.manifest_id and m.user_id = auth.uid()
  ));
