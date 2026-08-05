import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getFeatureFlag } from "@/services/featureFlagRepository";
import { LoginPageInner } from "./LoginPageInner";

// useSearchParams() (for the ?next= redirect target, e.g. from a delegate
// invite link) requires a Suspense boundary in the App Router, or the
// build fails — same pattern as /manifests's ?mtn= deep link.
export default async function LoginPage() {
  const supabase = await createClient();
  const mm2Enabled = await getFeatureFlag(supabase, "mm2_ui");

  return (
    <Suspense fallback={null}>
      <LoginPageInner mm2Enabled={mm2Enabled} />
    </Suspense>
  );
}
