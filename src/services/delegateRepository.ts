import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";

export type DelegateSiteType = "Generator" | "Transporter" | "Tsdf";

export interface DelegateRecord {
  id: string;
  owner_user_id: string;
  owner_email: string;
  delegate_user_id: string | null;
  invited_email: string;
  invite_token: string;
  allowed_site_types: DelegateSiteType[] | null;
  invited_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export interface ActiveDelegation {
  ownerUserId: string;
  ownerEmail: string;
  allowedSiteTypes: DelegateSiteType[] | null;
}

/** Owner-side: invites someone by email to quick-sign on their behalf. */
export async function createDelegateInvite(
  supabase: SupabaseClient,
  ownerUserId: string,
  ownerEmail: string,
  invitedEmail: string,
  allowedSiteTypes: DelegateSiteType[] | null
): Promise<{ success: true; inviteToken: string } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("quick_sign_delegates")
    .insert({
      owner_user_id: ownerUserId,
      owner_email: ownerEmail,
      invited_email: invitedEmail.trim().toLowerCase(),
      allowed_site_types: allowedSiteTypes,
    })
    .select("invite_token")
    .single();

  if (error) {
    // Most common real-world case: re-inviting an email that already has a
    // pending invite from this owner (blocked by the partial unique index).
    if (error.code === "23505") {
      return { success: false, error: "This email already has a pending invite." };
    }
    console.error("createDelegateInvite failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }

  return { success: true, inviteToken: data.invite_token as string };
}

export async function listDelegatesForOwner(
  supabase: SupabaseClient,
  ownerUserId: string
): Promise<DelegateRecord[]> {
  const { data, error } = await supabase
    .from("quick_sign_delegates")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("invited_at", { ascending: false });

  if (error) {
    console.error("listDelegatesForOwner failed:", describePostgrestError(error));
    return [];
  }
  return data ?? [];
}

export async function revokeDelegate(
  supabase: SupabaseClient,
  ownerUserId: string,
  delegateRowId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("quick_sign_delegates")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", delegateRowId)
    .eq("owner_user_id", ownerUserId);

  if (error) {
    console.error("revokeDelegate failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Accept-page lookup — relies on the "invitees can view their own pending
 * invite" RLS policy, which only matches when the logged-in user's email
 * equals invited_email, so this never leaks another person's invite. */
export async function getPendingInviteByToken(
  supabase: SupabaseClient,
  token: string
): Promise<DelegateRecord | null> {
  const { data, error } = await supabase
    .from("quick_sign_delegates")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();

  if (error) {
    console.error("getPendingInviteByToken failed:", describePostgrestError(error));
    return null;
  }
  return data;
}

export async function acceptDelegateInvite(
  supabase: SupabaseClient,
  token: string,
  delegateUserId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("quick_sign_delegates")
    .update({ delegate_user_id: delegateUserId, accepted_at: new Date().toISOString() })
    .eq("invite_token", token)
    .select("id")
    .maybeSingle();

  if (error) {
    // The "one active delegation per delegate" unique index (partial index
    // on delegate_user_id) is the most likely real-world trigger here.
    if (error.code === "23505") {
      return {
        success: false,
        error: "You already have an active delegation with another account. Revoke it first.",
      };
    }
    console.error("acceptDelegateInvite failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: "Invite not found, already accepted, or not addressed to you." };
  }
  return { success: true };
}

/** Used at sign time to resolve whose credentials a delegate should sign
 * with, and by the UI to show "signing on behalf of X" messaging. */
export async function getActiveDelegationForUser(
  supabase: SupabaseClient,
  delegateUserId: string
): Promise<ActiveDelegation | null> {
  const { data, error } = await supabase
    .from("quick_sign_delegates")
    .select("owner_user_id, owner_email, allowed_site_types")
    .eq("delegate_user_id", delegateUserId)
    .is("revoked_at", null)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (error) {
    console.error("getActiveDelegationForUser failed:", describePostgrestError(error));
    return null;
  }
  if (!data) return null;

  return {
    ownerUserId: data.owner_user_id as string,
    ownerEmail: data.owner_email as string,
    allowedSiteTypes: (data.allowed_site_types as DelegateSiteType[] | null) ?? null,
  };
}
