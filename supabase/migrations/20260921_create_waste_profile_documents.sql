-- Lets the ManifestMate Wizard keep the original waste-profile PDF a
-- generator uploaded on file, attached to the profile it produced --
-- an audit trail back to the actual document a profile was built from,
-- not just the extracted values. Mirrors
-- 20260821_create_ldr_notice_attachments.sql field-for-field (same
-- private-bucket-per-row shape), just retargeted at waste_profiles.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on `waste_profiles` already existing.

insert into storage.buckets (id, name, public)
values ('waste-profile-documents', 'waste-profile-documents', false)
on conflict (id) do nothing;

create table if not exists public.waste_profile_documents (
  id uuid primary key default gen_random_uuid(),
  waste_profile_id uuid not null references public.waste_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  -- Path within the waste-profile-documents bucket:
  -- {user_id}/{waste_profile_id}/{filename} -- the {user_id} prefix is
  -- what the storage.objects RLS policies below check against, so it
  -- must always be included when uploading.
  storage_path text not null,
  file_size_bytes integer,
  uploaded_at timestamptz not null default now()
);

create index if not exists waste_profile_documents_profile_id_idx
  on public.waste_profile_documents(waste_profile_id);

alter table public.waste_profile_documents enable row level security;

drop policy if exists "Users can view their own waste profile documents" on public.waste_profile_documents;
create policy "Users can view their own waste profile documents"
  on public.waste_profile_documents for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own waste profile documents" on public.waste_profile_documents;
create policy "Users can insert their own waste profile documents"
  on public.waste_profile_documents for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.waste_profiles
      where waste_profiles.id = waste_profile_documents.waste_profile_id
      and waste_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own waste profile documents" on public.waste_profile_documents;
create policy "Users can delete their own waste profile documents"
  on public.waste_profile_documents for delete
  using (user_id = auth.uid());

-- Storage.objects policies -- path convention is {user_id}/{waste_profile_id}/{filename},
-- so checking the first path segment against auth.uid() is enough; no join
-- to waste_profiles needed here.
drop policy if exists "Users can read their own waste profile document files" on storage.objects;
create policy "Users can read their own waste profile document files"
  on storage.objects for select
  using (
    bucket_id = 'waste-profile-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own waste profile document files" on storage.objects;
create policy "Users can upload their own waste profile document files"
  on storage.objects for insert
  with check (
    bucket_id = 'waste-profile-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own waste profile document files" on storage.objects;
create policy "Users can delete their own waste profile document files"
  on storage.objects for delete
  using (
    bucket_id = 'waste-profile-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
