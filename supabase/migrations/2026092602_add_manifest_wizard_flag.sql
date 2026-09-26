-- Manifest Wizard on/off (the guided pop-up-modal flow at
-- /manifests/new/wizard). Unlike the Profile Wizard (plus) and Segregation
-- Wizard (pro), this is pure manual UI with zero AI involvement -- flag
-- only, no minimum tier (see isManifestWizardEnabledForMeAction). Default
-- off; an admin opts accounts in from /admin once ready to test.

insert into feature_flags (key, enabled) values ('manifest_wizard', false)
  on conflict (key) do nothing;
