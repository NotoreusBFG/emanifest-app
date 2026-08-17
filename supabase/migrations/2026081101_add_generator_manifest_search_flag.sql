-- Feature flag for the new "search manifests by generator" lookup mode
-- (src/app/manifests/GeneratorSearchPanel.tsx / GeneratorManifestResults.tsx)
-- -- lets the admin turn it off instantly without a redeploy if the live
-- POST /emanifest/search integration misbehaves in production. Off by
-- default, same as mm2_ui was when it shipped -- see
-- 20260823_create_feature_flags.sql for the table itself and the RLS
-- policies this row is governed by (no new policy needed here).

insert into feature_flags (key, enabled) values ('generator_manifest_search', false)
  on conflict (key) do nothing;
