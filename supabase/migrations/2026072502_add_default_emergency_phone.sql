-- Adds a per-user default emergency response phone number, used to
-- pre-fill the generator/facility emergency phone fields on the manifest
-- form instead of hardcoded placeholder data. Nullable -- falls back to
-- the system default (see src/lib/constants.ts) when not set.
--
-- Also relaxes epa_api_id/epa_api_key to nullable: this field is saved
-- independently of API credentials (its own form/action, so changing your
-- emergency phone default never requires re-entering your real API key,
-- which is write-only and never redisplayed) -- a user who sets their
-- phone default before ever saving credentials needs to be able to INSERT
-- a user_credentials row without them.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder.

alter table public.user_credentials
  add column if not exists default_emergency_phone text;

alter table public.user_credentials
  alter column epa_api_id drop not null;

alter table public.user_credentials
  alter column epa_api_key drop not null;
