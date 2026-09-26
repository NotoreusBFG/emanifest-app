"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { getMyAdminRole } from "@/services/adminRepository";
import { setAccountTier, type AccountTier } from "@/services/entitlementRepository";

const VALID_TIERS: AccountTier[] = ["free", "plus", "pro"];

export async function setAccountTierAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Same combined check admin/page.tsx itself uses to decide who sees this
  // UI at all (env-var allowlist OR DB-granted admin_users role) -- belt-
  // and-suspenders with set_account_tier()'s own is_admin_caller() check
  // at the database level, same reasoning as toggleFeatureFlagAction.
  const dbAdminRole = user ? await getMyAdminRole(supabase) : null;
  if (!isAdminEmail(user?.email) && !dbAdminRole) {
    throw new Error("Not authorized");
  }

  const targetUserId = formData.get("userId");
  const tier = formData.get("tier");
  if (typeof targetUserId !== "string" || !targetUserId) {
    throw new Error("Missing userId");
  }
  if (typeof tier !== "string" || !VALID_TIERS.includes(tier as AccountTier)) {
    throw new Error("Invalid tier");
  }

  const result = await setAccountTier(supabase, targetUserId, tier as AccountTier);
  if (!result.success) throw new Error(result.error ?? "Failed to set tier");

  revalidatePath("/admin");
}
