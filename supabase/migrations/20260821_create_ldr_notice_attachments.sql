-- Lets a generator attach a third-party PDF (e.g. a lab's LDR
-- determination letter, a broker's waste profile) to an LDR notice so it's
-- kept on file alongside ManifestMate's own generated notice. Entirely
-- separate from `manifest_documents` (EPA-fetched signed-manifest PDFs) --
-- these are user-supplied, not RCRAInfo attachments.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on `ldr_notices` already existing.

insert into storage.buckets (id, name, public)
values ('ldr-attachments', 'ldr-attachments', false)
on conflict (id) do nothing;

create table if not exists public.ldr_notice_attachments (
  id uuid primary key default gen_random_uuid(),
  ldr_notice_id uuid not null references public.ldr_notices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  -- Path within the ldr-attachments bucket: {user_id}/{ldr_notice_id}/{filename}
  -- -- the {user_id} prefix is what the storage.objects RLS policies below
  -- check against, so it must always be included when uploading.
  storage_path text not null,
  file_size_bytes integer,
  -- Free-text note on where this came from (e.g. "Acme Labs LDR determination")
  -- -- optional, purely descriptive.
  label text,
  uploaded_at timestamptz not null default now()
);

create index if not exists ldr_notice_attachments_notice_id_idx
  on public.ldr_notice_attachments(ldr_notice_id);

alter table public.ldr_notice_attachments enable row level security;

drop policy if exists "Users can view their own LDR attachments" on public.ldr_notice_attachments;
create policy "Users can view their own LDR attachments"
  on public.ldr_notice_attachments for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own LDR attachments" on public.ldr_notice_attachments;
create policy "Users can insert their own LDR attachments"
  on public.ldr_notice_attachments for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ldr_notices
      where ldr_notices.id = ldr_notice_attachments.ldr_notice_id
      and ldr_notices.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own LDR attachments" on public.ldr_notice_attachments;
create policy "Users can delete their own LDR attachments"
  on public.ldr_notice_attachments for delete
  using (user_id = auth.uid());

-- Storage.objects policies -- path convention is {user_id}/{ldr_notice_id}/{filename},
-- so checking the first path segment against auth.uid() is enough; no join
-- to ldr_notices needed here.
drop policy if exists "Users can read their own LDR attachment files" on storage.objects;
create policy "Users can read their own LDR attachment files"
  on storage.objects for select
  using (
    bucket_id = 'ldr-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own LDR attachment files" on storage.objects;
create policy "Users can upload their own LDR attachment files"
  on storage.objects for insert
  with check (
    bucket_id = 'ldr-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own LDR attachment files" on storage.objects;
create policy "Users can delete their own LDR attachment files"
  on storage.objects for delete
  using (
    bucket_id = 'ldr-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
