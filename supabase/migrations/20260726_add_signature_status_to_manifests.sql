-- Adds per-role signature timestamps to the local manifests mirror, so the
-- dashboard can show checkmarks without a live API call per row (the same
-- reasoning as the rest of that table). Populated by
-- recordManifestLocally() using getHandlerSignatureStatus() (types.ts),
-- which already knows how to tell a real signature apart from EPA's
-- placeholder electronicSignaturesInfo entries -- see that function's
-- comment for the gotcha it handles.
--
-- transporter_signed_at represents ALL transporters having signed (the
-- latest of their signature dates), not just the first one -- meaningful
-- even once multi-transporter manifests are supported, since "the
-- transport leg is complete" is the useful single checkmark for an
-- overview table.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder.

alter table public.manifests
  add column if not exists generator_signed_at timestamptz,
  add column if not exists transporter_signed_at timestamptz,
  add column if not exists facility_signed_at timestamptz;
