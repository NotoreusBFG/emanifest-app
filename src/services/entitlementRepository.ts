import type { SupabaseClient } from "@supabase/supabase-js";

// Minimal manual entitlement scaffold (2026-09-26) -- no billing/Stripe,
// admin-assignable only via set_account_tier() (see the migration for why
// no new RLS policy was needed: profiles has no client update policy at
// all). Ordered tiers so a higher tier automatically clears a lower-tier
// feature's requirement -- see TIER_RANK below.
export type AccountTier = "free" | "plus" | "pro";

const TIERS: AccountTier[] = ["free", "plus", "pro"];

const TIER_RANK: Record<AccountTier, number> = { free: 0, plus: 1, pro: 2 };

/**
 * Fail-closed to "free" on any missing row/query error -- same posture as
 * getFeatureFlag()/getAccountType(): an unreadable tier should degrade to
 * the least-privileged state, not silently grant access.
 */
export async function getAccountTier(supabase: SupabaseClient, userId: string): Promise<AccountTier> {
  const { data, error } = await supabase.from("profiles").select("tier").eq("user_id", userId).maybeSingle();
  if (error || !data) return "free";
  return TIERS.includes(data.tier) ? data.tier : "free";
}

/**
 * Single chokepoint for "does this account meet at least the required
 * tier" -- every gated wizard action calls this rather than comparing
 * tier strings itself, so tier ordering/definitions can change later
 * without touching call sites.
 */
export async function hasMinimumTier(supabase: SupabaseClient, userId: string, required: AccountTier): Promise<boolean> {
  const actual = await getAccountTier(supabase, userId);
  return TIER_RANK[actual] >= TIER_RANK[required];
}

/** Admin-only write, via the set_account_tier() RPC (SECURITY DEFINER,
 * checks is_admin_caller() itself -- see the migration). The client never
 * writes profiles.tier directly. */
export async function setAccountTier(
  supabase: SupabaseClient,
  userId: string,
  tier: AccountTier
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("set_account_tier", { target_user_id: userId, new_tier: tier });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type AccountForTier = { userId: string; email: string; accountType: string; tier: AccountTier };

/** Every account, for the admin tier-assignment UI, via the
 * list_accounts_for_tier() RPC (SECURITY DEFINER, admin-only -- see the
 * migration and its list_pending_profiles() precedent). */
export async function listAccountsForTier(supabase: SupabaseClient): Promise<AccountForTier[]> {
  const { data, error } = await supabase.rpc("list_accounts_for_tier");
  if (error || !data) return [];
  return (data as { user_id: string; email: string; account_type: string; tier: string }[]).map((row) => ({
    userId: row.user_id,
    email: row.email,
    accountType: row.account_type,
    tier: TIERS.includes(row.tier as AccountTier) ? (row.tier as AccountTier) : "free",
  }));
}
