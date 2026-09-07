-- Waste profiles previously carried only a disposal-facility EPA ID with no
-- generator association at all. A generator must now be selected before a
-- profile can be created (src/app/profiles/page.tsx), so it can be reused
-- for label printing without re-entry.
--
-- No non-blank check (unlike disposal_facility_epa_id's) -- there's no
-- reliable value to backfill existing rows with. App code treats
-- generator_epa_id = '' as "legacy profile, needs a generator assigned
-- before reuse" rather than a constraint violation.
alter table waste_profiles
  add column if not exists generator_epa_id text not null default '',
  add column if not exists generator_name text not null default '',
  add column if not exists generator_address text not null default '';
