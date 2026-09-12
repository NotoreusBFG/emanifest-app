-- ManifestMate Wizard on/off, settable separately for generator vs.
-- third-party accounts (feature_flags has no per-audience column, so two
-- separate all-or-nothing flags is the path of least resistance -- see
-- 2026081101_add_generator_manifest_search_flag.sql for the same pattern).
-- Both default off; an admin opts each audience in from /admin once the
-- Wizard is ready to test.

insert into feature_flags (key, enabled) values ('manifestmate_wizard_generator', false)
  on conflict (key) do nothing;

insert into feature_flags (key, enabled) values ('manifestmate_wizard_third_party', false)
  on conflict (key) do nothing;
