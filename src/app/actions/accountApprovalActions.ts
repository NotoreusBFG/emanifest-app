"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { listPendingAccounts, approveAccount, type PendingAccount } from "@/services/profileRepository";

export async function listPendingAccountsAction(): Promise<PendingAccount[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders with list_pending_profiles()'s own is_admin_caller()
  // check — same pattern as featureFlagActions.ts.
  if (!isAdminEmail(user?.email)) return [];

  return listPendingAccounts(supabase);
}

export async function approveAccountAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    throw new Error("Not authorized");
  }

  const targetUserId = formData.get("userId");
  if (typeof targetUserId !== "string" || !targetUserId) {
    throw new Error("Missing userId");
  }

  await approveAccount(supabase, targetUserId);
  revalidatePath("/admin");
}
