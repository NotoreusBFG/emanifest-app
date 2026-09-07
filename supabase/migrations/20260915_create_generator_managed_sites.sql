-- Self-declared generator sites a "generator"-type account manages, used to
-- lock down generator selection everywhere (waste profiles, label
-- printing, manifest creation) instead of the open EPA site search any
-- account could previously use. Same trust level as the existing
-- onboarding epa_id_number field (see epa_registration_progress) --
-- RCRAInfo's API has no endpoint to verify which sites a credential pair
-- actually manages, so this is self-attestation, not EPA-verified.
--
-- Run this in the Supabase Dashboard -> SQL Editor (or `npx supabase db
-- push`), same as the other migrations in this folder.

create table if not exists public.generator_managed_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  epa_site_id text not null,
  -- Snapshotted at add-time via getSiteDetailsAction, same "cache, don't
  -- re-fetch live" reasoning as label_prints -- just enough to render this
  -- list and the locked selector's dropdown without another RCRAInfo call.
  site_name text not null default '',
  site_address text not null default '',
  created_at timestamptz not null default now(),

  constraint generator_managed_sites_epa_id_not_blank check (epa_site_id <> '')
);

create unique index if not exists generator_managed_sites_user_site_idx
  on public.generator_managed_sites(user_id, epa_site_id);
create index if not exists generator_managed_sites_user_id_idx
  on public.generator_managed_sites(user_id);

alter table public.generator_managed_sites enable row level security;

drop policy if exists "Users can view their own managed sites" on public.generator_managed_sites;
create policy "Users can view their own managed sites"
  on public.generator_managed_sites for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own managed sites" on public.generator_managed_sites;
create policy "Users can add their own managed sites"
  on public.generator_managed_sites for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own managed sites" on public.generator_managed_sites;
create policy "Users can remove their own managed sites"
  on public.generator_managed_sites for delete
  using (auth.uid() = user_id);
-- Deliberately no update policy -- a declared site is add/remove only, same
-- reasoning as quick_sign_delegates having no field-level edit after invite.

-- Backfill: promote every existing generator account's single onboarding
-- EPA ID into this table, so the locked selector has something to show
-- immediately post-deploy with no forced re-entry.
insert into public.generator_managed_sites (user_id, epa_site_id)
select p.user_id, erp.epa_id_number
from public.profiles p
join public.epa_registration_progress erp on erp.user_id = p.user_id
where p.account_type = 'generator'
  and erp.epa_id_number is not null and erp.epa_id_number <> ''
on conflict (user_id, epa_site_id) do nothing;
