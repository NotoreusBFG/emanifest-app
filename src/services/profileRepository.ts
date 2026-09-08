import type { SupabaseClient } from "@supabase/supabase-js";

// Schema supports all four (see 20260906_widen_account_types.sql), but only
// 'generator' (self-serve default) and 'transporter' (invite-only, see
// authActions.ts) are reachable through any signup path today. 'disposal'
// and 'third_party' are schema-ready for when those account types are
// built out.
export type AccountType = "generator" | "transporter" | "disposal" | "third_party";

const ACCOUNT_TYPES: AccountType[] = ["generator", "transporter", "disposal", "third_party"];

/**
 * Fail-open to 'generator' on any missing row, query error, or unrecognized
 * value — this is a UX signal for nav branching, not a security boundary,
 * so a migration/deploy ordering slip should degrade to the existing, safe
 * generator nav rather than break it.
 */
export async function getAccountType(supabase: SupabaseClient, userId: string): Promise<AccountType> {
  const { data, error } = await supabase.from("profiles").select("account_type").eq("user_id", userId).maybeSingle();
  if (error || !data) return "generator";
  return ACCOUNT_TYPES.includes(data.account_type) ? data.account_type : "generator";
}

export type ProfileGate = { accountType: AccountType; approved: boolean; rejected: boolean };

const APPROVAL_GATED_TYPES: AccountType[] = ["generator", "third_party"];

/**
 * Combined account-type + approval-status lookup for the middleware's
 * per-request access gate (see 2026090601_add_approval_gate_to_profiles.sql,
 * 20260917_extend_approval_gate_to_third_party.sql, and
 * 2026091802_add_reject_profile.sql). Only generator and third_party
 * accounts are actually gated — transporter accounts are already vetted by
 * the inviting generator, so they read as approved regardless of the DB
 * value. Fails open (approved: true) on any missing row or query error,
 * same reasoning as getAccountType above — a migration/deploy ordering
 * slip should never lock real users out of a live site.
 */
export async function getProfileGate(supabase: SupabaseClient, userId: string): Promise<ProfileGate> {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_type, approved_at, rejected_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return { accountType: "generator", approved: true, rejected: false };
  const accountType = ACCOUNT_TYPES.includes(data.account_type) ? data.account_type : "generator";
  const gated = APPROVAL_GATED_TYPES.includes(accountType);
  const rejected = gated && data.rejected_at !== null;
  const approved = !gated || data.approved_at !== null;
  return { accountType, approved, rejected };
}

export type PendingAccount = { userId: string; email: string; createdAt: string };

/**
 * Pending generator signups for the admin panel, via the
 * list_pending_profiles() RPC (SECURITY DEFINER — it's the only way to
 * join auth.users for email, and it re-checks admin status itself as the
 * real authorization boundary; the caller's own isAdminEmail() check in
 * accountApprovalActions.ts is belt-and-suspenders on top of that).
 */
export async function listPendingAccounts(supabase: SupabaseClient): Promise<PendingAccount[]> {
  const { data, error } = await supabase.rpc("list_pending_profiles");
  if (error || !data) return [];
  return data.map((row: { user_id: string; email: string; created_at: string }) => ({
    userId: row.user_id,
    email: row.email,
    createdAt: row.created_at,
  }));
}

/** Grants access via the approve_profile() RPC — see listPendingAccounts's comment.
 * Also reverses a prior rejection, if any (see 2026091802_add_reject_profile.sql). */
export async function approveAccount(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.rpc("approve_profile", { target_user_id: userId });
  if (error) throw new Error(error.message);
}

/** Declines a pending signup via the reject_profile() RPC — keeps the
 * account blocked and records the rejection, rather than deleting it, so
 * an admin has a record and can reverse the decision later by approving. */
export async function rejectAccount(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.rpc("reject_profile", { target_user_id: userId });
  if (error) throw new Error(error.message);
}

export type RejectedAccount = { userId: string; email: string; rejectedAt: string };

/** Rejected accounts for the admin panel's record-keeping + reversal UI. */
export async function listRejectedAccounts(supabase: SupabaseClient): Promise<RejectedAccount[]> {
  const { data, error } = await supabase.rpc("list_rejected_profiles");
  if (error || !data) return [];
  return data.map((row: { user_id: string; email: string; rejected_at: string }) => ({
    userId: row.user_id,
    email: row.email,
    rejectedAt: row.rejected_at,
  }));
}
