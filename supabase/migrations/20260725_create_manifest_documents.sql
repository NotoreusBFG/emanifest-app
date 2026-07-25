-- Storage for the actual PDF/HTML documents RCRAInfo generates for a
-- manifest, fetched via GET /emanifest/manifest/{mtn}/attachments (a zip
-- of however many files EPA has at that point -- confirmed live: 2 PDFs
-- ["form-2050.pdf", the completed form, and
-- "form-2050_quantities_blank.pdf"] plus one "*-human-readable.html" per
-- signer). Storing our own copy rather than re-fetching from EPA every
-- time a user wants to view/print something, per the "repository the user
-- can always find documents in" product goal.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on the `manifests` table already
-- existing (20260725_create_manifests_table.sql).

insert into storage.buckets (id, name, public)
values ('manifest-documents', 'manifest-documents', false)
on conflict (id) do nothing;

create table if not exists public.manifest_documents (
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid not null references public.manifests(id) on delete cascade,
  filename text not null,
  -- Path within the manifest-documents bucket: {user_id}/{manifest_id}/{filename}
  -- -- the {user_id} prefix is what the storage.objects RLS policies below
  -- check against, so it must always be included when uploading.
  storage_path text not null,
  file_size_bytes integer,
  fetched_at timestamptz not null default now(),
  unique (manifest_id, filename)
);

create index if not exists manifest_documents_manifest_id_idx
  on public.manifest_documents(manifest_id);

alter table public.manifest_documents enable row level security;

drop policy if exists "Users can view their own manifest documents" on public.manifest_documents;
create policy "Users can view their own manifest documents"
  on public.manifest_documents for select
  using (
    exists (
      select 1 from public.manifests
      where manifests.id = manifest_documents.manifest_id
      and manifests.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their own manifest documents" on public.manifest_documents;
create policy "Users can insert their own manifest documents"
  on public.manifest_documents for insert
  with check (
    exists (
      select 1 from public.manifests
      where manifests.id = manifest_documents.manifest_id
      and manifests.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own manifest documents" on public.manifest_documents;
create policy "Users can update their own manifest documents"
  on public.manifest_documents for update
  using (
    exists (
      select 1 from public.manifests
      where manifests.id = manifest_documents.manifest_id
      and manifests.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own manifest documents" on public.manifest_documents;
create policy "Users can delete their own manifest documents"
  on public.manifest_documents for delete
  using (
    exists (
      select 1 from public.manifests
      where manifests.id = manifest_documents.manifest_id
      and manifests.user_id = auth.uid()
    )
  );

-- Storage.objects policies -- path convention is {user_id}/{manifest_id}/{filename},
-- so checking the first path segment against auth.uid() is enough; no join
-- to the manifests table needed here.
drop policy if exists "Users can read their own manifest document files" on storage.objects;
create policy "Users can read their own manifest document files"
  on storage.objects for select
  using (
    bucket_id = 'manifest-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own manifest document files" on storage.objects;
create policy "Users can upload their own manifest document files"
  on storage.objects for insert
  with check (
    bucket_id = 'manifest-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own manifest document files" on storage.objects;
create policy "Users can update their own manifest document files"
  on storage.objects for update
  using (
    bucket_id = 'manifest-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own manifest document files" on storage.objects;
create policy "Users can delete their own manifest document files"
  on storage.objects for delete
  using (
    bucket_id = 'manifest-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
