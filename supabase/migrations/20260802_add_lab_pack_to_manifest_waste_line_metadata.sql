-- Adds a lab-pack flag alongside the wastewater/nonwastewater category
-- already captured per manifest waste line (20260731). Another
-- ManifestMate-only field -- RCRAInfo's manifest schema has no concept of
-- this either. Lets the LDR notice's "how must this waste be managed?"
-- picker default straight to letter E (lab pack, 40 CFR 268.42(c)) when
-- prefilled from a manifest whose waste line was flagged this way, instead
-- of the generic letter A default.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as every other
-- migration in this folder.

alter table public.manifest_waste_line_metadata
  add column if not exists is_lab_pack boolean not null default false;
