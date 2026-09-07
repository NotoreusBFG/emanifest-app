import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminRole = "admin" | "super_admin";

export interface AdminRecord {
  email: string;
  role: AdminRole;
}

/** The calling user's own admin role, or null if they aren't one — used
 * for the account-type/admin badge under the nav email, and to gate the
 * "manage admins" UI to super admins only. Reads via get_my_admin_role()
 * (SECURITY DEFINER — admin_users has RLS enabled with zero policies, so
 * a plain select would return nothing regardless of a WHERE match). */
export async function getMyAdminRole(supabase: SupabaseClient): Promise<AdminRole | null> {
  const { data, error } = await supabase.rpc("get_my_admin_role");
  if (error || !data) return null;
  return data as AdminRole;
}

export async function listAdmins(supabase: SupabaseClient): Promise<AdminRecord[]> {
  const { data, error } = await supabase.rpc("list_admins");
  if (error || !data) return [];
  return data as AdminRecord[];
}

/** Only a super admin can actually grant this (enforced by grant_admin()'s
 * own is_super_admin_caller() check) — a non-super-admin caller's
 * invocation just raises 'not authorized'. */
export async function grantAdmin(
  supabase: SupabaseClient,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("grant_admin", { target_email: email });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function revokeAdmin(
  supabase: SupabaseClient,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("revoke_admin", { target_email: email });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
