-- Segregation Wizard on/off, generator accounts only for now (lab packs
-- have no third-party surface today, unlike the Profile Wizard's two
-- audiences -- see 2026092101_add_manifestmate_wizard_flags.sql for that
-- pattern, mirrored here for the one audience that applies). Default off;
-- an admin opts generators in from /admin once the Wizard is ready to test.

insert into feature_flags (key, enabled) values ('manifestmate_labpack_wizard_generator', false)
  on conflict (key) do nothing;
