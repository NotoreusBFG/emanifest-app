"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { getMyAdminRole } from "@/services/adminRepository";
import {
  listPendingAccounts,
  approveAccount,
  rejectAccount,
  listRejectedAccounts,
  type PendingAccount,
  type RejectedAccount,
} from "@/services/profileRepository";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Combines the env-var admin allowlist with the DB-granted role, same as
 * adminActions.ts's getMyAdminRoleAction — a pure DB-granted admin (not
 * also in ADMIN_EMAILS) would otherwise be blocked here even though the
 * underlying RPCs' own is_admin_caller() check would allow them. */
async function callerIsAdmin(supabase: SupabaseClient, email: string | null | undefined): Promise<boolean> {
  if (await getMyAdminRole(supabase)) return true;
  return isAdminEmail(email);
}

export async function listPendingAccountsAction(): Promise<PendingAccount[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders with list_pending_profiles()'s own is_admin_caller()
  // check — same pattern as featureFlagActions.ts.
  if (!(await callerIsAdmin(supabase, user?.email))) return [];

  return listPendingAccounts(supabase);
}

export async function approveAccountAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await callerIsAdmin(supabase, user?.email))) {
    throw new Error("Not authorized");
  }

  const targetUserId = formData.get("userId");
  if (typeof targetUserId !== "string" || !targetUserId) {
    throw new Error("Missing userId");
  }

  await approveAccount(supabase, targetUserId);
  revalidatePath("/admin");
}

export async function rejectAccountAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await callerIsAdmin(supabase, user?.email))) {
    throw new Error("Not authorized");
  }

  const targetUserId = formData.get("userId");
  if (typeof targetUserId !== "string" || !targetUserId) {
    throw new Error("Missing userId");
  }

  await rejectAccount(supabase, targetUserId);
  revalidatePath("/admin");
}

export async function listRejectedAccountsAction(): Promise<RejectedAccount[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await callerIsAdmin(supabase, user?.email))) return [];
  return listRejectedAccounts(supabase);
}
