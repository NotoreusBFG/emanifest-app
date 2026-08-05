import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountType = "generator" | "transporter";

/**
 * Fail-open to 'generator' on any missing row or query error — this is a
 * UX signal for nav branching, not a security boundary, so a migration/
 * deploy ordering slip should degrade to the existing, safe generator nav
 * rather than break it.
 */
export async function getAccountType(supabase: SupabaseClient, userId: string): Promise<AccountType> {
  const { data, error } = await supabase.from("profiles").select("account_type").eq("user_id", userId).maybeSingle();
  if (error || !data) return "generator";
  return data.account_type === "transporter" ? "transporter" : "generator";
}
