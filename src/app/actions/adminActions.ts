"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  getMyAdminRole,
  listAdmins,
  grantAdmin,
  revokeAdmin,
  type AdminRole,
  type AdminRecord,
} from "@/services/adminRepository";

/** Combines the env-var admin allowlist (ADMIN_EMAILS — the original,
 * redeploy-only mechanism) with the DB-granted role (admin_users.role —
 * grantable at runtime by a super admin). An env-var-listed admin who has
 * no admin_users row yet still reads as 'admin' here, so nobody already
 * relying on ADMIN_EMAILS loses access when this ships. */
export async function getMyAdminRoleAction(): Promise<AdminRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dbRole = await getMyAdminRole(supabase);
  if (dbRole) return dbRole;

  return isAdminEmail(user.email) ? "admin" : null;
}

export async function listAdminsAction(): Promise<AdminRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listAdmins(supabase);
}

export type AdminRoleActionState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null;

export async function grantAdminAction(
  prevState: AdminRoleActionState,
  formData: FormData
): Promise<AdminRoleActionState> {
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
  if (!email) return { success: false, error: "Enter an email address." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await grantAdmin(supabase, email);
  if (!result.success) return { success: false, error: result.error ?? "Failed to grant admin access." };

  revalidatePath("/admin");
  return { success: true, message: `${email} is now an admin.` };
}

export async function revokeAdminAction(email: string): Promise<AdminRoleActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await revokeAdmin(supabase, email);
  if (!result.success) return { success: false, error: result.error ?? "Failed to revoke admin access." };

  revalidatePath("/admin");
  return { success: true, message: "Admin access revoked." };
}
