-- Redesigns ldr_notices around the full 40 CFR 268.7(a)(4) "how must this
-- waste be managed" letter set (A-I), selected PER WASTE LINE, replacing
-- the original binary Path A / Path B model from
-- 20260730_create_ldr_notices.sql. See "ldr schema.md" at the repo root
-- for the full reasoning (a real industry LDR form reviewed with the
-- user surfaced this).
--
-- BREAKING CHANGE: drops the old path/certification_* columns outright
-- rather than migrating their data. This project has no real customers
-- yet -- any notices filed against the old schema during testing are
-- disposable dev/test data, not something worth a data-preserving
-- migration for. If that's wrong for your situation, back up
-- ldr_notices before running this.
--
-- `waste_lines` stays a jsonb column (no schema change needed there) but
-- its INTERNAL shape changes: each entry now carries `howManaged` (one of
-- A-I) and an optional `manifestLineNumber`, instead of the notice having
-- one shared path for everything -- see src/lib/ldr/types.ts.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as every other
-- migration in this folder.

alter table public.ldr_notices
  drop constraint if exists ldr_notices_certification_required_for_path_b;

alter table public.ldr_notices
  drop column if exists path,
  drop column if exists certification_signed_by_name,
  drop column if exists certification_signed_at,
  drop column if exists certification_text;

-- Array of LdrCertification (letter, heading, certificationText,
-- signedByName, signedAt) -- one per distinct letter actually used among
-- this notice's waste lines that requires a signed certification. Empty
-- array is valid (e.g. a notice where every line is letter A -- notice
-- only, nothing to certify).
alter table public.ldr_notices
  add column if not exists certifications jsonb not null default '[]'::jsonb;

-- Every notice needs a preparer name and date, independent of whether any
-- waste line's letter actually triggers a certification -- matches real
-- LDR forms, which are always named/dated at the bottom regardless of
-- which lettered statement applies. Nullable at the DB level (existing
-- rows have none) but required by createLdrNoticeAction going forward.
-- prepared_date already exists (defaults to current_date).
alter table public.ldr_notices
  add column if not exists prepared_by_name text;
