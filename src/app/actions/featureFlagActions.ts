"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { setFeatureFlag } from "@/services/featureFlagRepository";

export async function toggleFeatureFlagAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders with the RLS policy on feature_flags: even if this
  // check were ever bypassed, the update itself is also admin-only at the
  // database level.
  if (!isAdminEmail(user?.email)) {
    throw new Error("Not authorized");
  }

  const key = formData.get("key");
  const enabled = formData.get("enabled") === "true";
  if (typeof key !== "string" || !key) {
    throw new Error("Missing flag key");
  }

  await setFeatureFlag(supabase, key, enabled);
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}
