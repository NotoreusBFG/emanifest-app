"use server";

import { createClient } from "@/lib/supabase/server";
import { getFeatureFlag } from "@/services/featureFlagRepository";

/**
 * Gate for the Manifest Wizard -- feature flag only, no minimum tier
 * (2026-09-26 entitlement scaffold, client directive: purely manual UI,
 * zero AI involvement, zero AI cost -- unlike the Profile Wizard (plus) and
 * Segregation Wizard (pro), so it stays free for any signed-in account once
 * an admin turns the flag on).
 */
export async function isManifestWizardEnabledForMeAction(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return getFeatureFlag(supabase, "manifest_wizard");
}
