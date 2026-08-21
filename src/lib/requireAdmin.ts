import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

/**
 * Shared admin gate for Server Actions that write to admin-only tables
 * (leads, lead_activities, call_scripts). Belt-and-suspenders with each
 * table's RLS policy — even if this check were bypassed, the write itself
 * is also admin-only at the database level (see is_admin_caller()).
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    throw new Error("Not authorized");
  }
  return { supabase, user };
}
