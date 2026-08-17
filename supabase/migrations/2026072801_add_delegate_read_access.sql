-- Follow-up to 20260727_create_quick_sign_delegates.sql: that migration
-- gave delegates INSERT/UPDATE access to manifests/manifest_documents/
-- storage.objects (so a delegated sign's data can be written under the
-- owner's account), but missed SELECT access -- which turned out to be
-- needed for two things found during live-testing:
--
-- 1. recordManifestLocally() does an upsert().select() -- PostgREST needs
--    a SELECT policy to permit, not just INSERT/UPDATE, for that trailing
--    select to return the row back to the caller.
-- 2. A delegate needs to be able to look up a manifest at all (by MTN) to
--    find something to sign in the first place -- getRcrainfoClientForAction
--    in manifestService.ts now resolves the live RCRAInfo call through the
--    owner's credentials for this, but listStoredDocumentsAction still
--    needs to read the resulting local manifests/manifest_documents rows,
--    and those live under the owner's user_id, not the delegate's.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260727_create_quick_sign_delegates.sql already being applied (uses its
-- is_active_delegate_for() helper function).

drop policy if exists "Delegates can view manifests for their owner" on public.manifests;
create policy "Delegates can view manifests for their owner"
  on public.manifests for select
  using (public.is_active_delegate_for(user_id));

drop policy if exists "Delegates can view documents for their owner" on public.manifest_documents;
create policy "Delegates can view documents for their owner"
  on public.manifest_documents for select
  using (
    exists (
      select 1 from public.manifests
      where manifests.id = manifest_documents.manifest_id
      and public.is_active_delegate_for(manifests.user_id)
    )
  );

drop policy if exists "Delegates can read document files for their owner" on storage.objects;
create policy "Delegates can read document files for their owner"
  on storage.objects for select
  using (
    bucket_id = 'manifest-documents'
    and public.is_active_delegate_for(((storage.foldername(name))[1])::uuid)
  );
