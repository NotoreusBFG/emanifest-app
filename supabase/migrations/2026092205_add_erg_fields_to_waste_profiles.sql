-- Adds an on/off ERG (Emergency Response Guidebook) toggle and the stored
-- guide number to waste_profiles. When enabled, the guide number is
-- appended to the printed DOT shipping description on any manifest waste
-- line populated from this profile (see buildManifestInput.ts).
alter table waste_profiles
  add column erg_enabled boolean not null default false,
  add column erg_number text;
