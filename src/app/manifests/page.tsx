import { createClient } from "@/lib/supabase/server";
import { getFeatureFlag } from "@/services/featureFlagRepository";
import { ManifestLookupPageClient } from "./ManifestLookupPageClient";

/**
 * Thin server wrapper — reads the `generator_manifest_search` admin
 * feature flag (see /admin) server-side, same pattern layout.tsx already
 * uses for `mm2_ui`, then hands it down as a prop to the actual client
 * component. Needed because the page itself is a client component (heavy
 * useActionState/useSearchParams usage) and getFeatureFlag requires a
 * server Supabase client.
 */
export default async function ManifestLookupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const generatorSearchEnabled = user ? await getFeatureFlag(supabase, "generator_manifest_search") : false;

  return <ManifestLookupPageClient generatorSearchEnabled={generatorSearchEnabled} />;
}
