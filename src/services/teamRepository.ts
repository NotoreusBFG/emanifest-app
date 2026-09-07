import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";

export interface TeamMemberRecord {
  id: string;
  owner_user_id: string;
  owner_email: string;
  member_user_id: string | null;
  invited_email: string;
  invite_token: string;
  invited_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export interface ActiveTeamMembership {
  ownerUserId: string;
  ownerEmail: string;
}

/** Owner-side: invites someone by email to join their team -- full shared
 * workspace (generator sites, waste profiles, dashboard) and creation/
 * signing rights, unlike Quick-Sign delegation's sign-only scope. */
export async function createTeamInvite(
  supabase: SupabaseClient,
  ownerUserId: string,
  ownerEmail: string,
  invitedEmail: string
): Promise<{ success: true; inviteToken: string } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("team_members")
    .insert({
      owner_user_id: ownerUserId,
      owner_email: ownerEmail,
      invited_email: invitedEmail.trim().toLowerCase(),
    })
    .select("invite_token")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "This email already has a pending invite." };
    }
    console.error("createTeamInvite failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }

  return { success: true, inviteToken: data.invite_token as string };
}

export async function listTeamForOwner(
  supabase: SupabaseClient,
  ownerUserId: string
): Promise<TeamMemberRecord[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("invited_at", { ascending: false });

  if (error) {
    console.error("listTeamForOwner failed:", describePostgrestError(error));
    return [];
  }
  return data ?? [];
}

export async function revokeTeamMember(
  supabase: SupabaseClient,
  ownerUserId: string,
  teamMemberRowId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("team_members")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", teamMemberRowId)
    .eq("owner_user_id", ownerUserId);

  if (error) {
    console.error("revokeTeamMember failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function getPendingTeamInviteByToken(
  supabase: SupabaseClient,
  token: string
): Promise<TeamMemberRecord | null> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();

  if (error) {
    console.error("getPendingTeamInviteByToken failed:", describePostgrestError(error));
    return null;
  }
  return data;
}

export async function acceptTeamInvite(
  supabase: SupabaseClient,
  token: string,
  memberUserId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("team_members")
    .update({ member_user_id: memberUserId, accepted_at: new Date().toISOString() })
    .eq("invite_token", token)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "You're already on another team. Leave/be removed from it first.",
      };
    }
    console.error("acceptTeamInvite failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: "Invite not found, already accepted, or not addressed to you." };
  }
  return { success: true };
}

/** Used everywhere a team member's session needs to resolve "whose
 * workspace am I actually in" -- credentials, dashboard, settings, create
 * flows. While a team membership is active, it takes full precedence over
 * the caller's own data/credentials (see the migration's comment for why:
 * no blended view). */
export async function getActiveTeamMembershipForUser(
  supabase: SupabaseClient,
  memberUserId: string
): Promise<ActiveTeamMembership | null> {
  const { data, error } = await supabase
    .from("team_members")
    .select("owner_user_id, owner_email")
    .eq("member_user_id", memberUserId)
    .is("revoked_at", null)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (error) {
    console.error("getActiveTeamMembershipForUser failed:", describePostgrestError(error));
    return null;
  }
  if (!data) return null;

  return {
    ownerUserId: data.owner_user_id as string,
    ownerEmail: data.owner_email as string,
  };
}

/** Resolves which user_id's data the caller should actually see/act
 * under -- the team owner's, if the caller is an active team member,
 * otherwise their own. Pure data-visibility resolution, no RCRAInfo
 * credentials involved -- see manifestService.ts's getRcrainfoClientForTeam
 * for the credential-aware equivalent used at create/sign time. */
export async function resolveEffectiveUserId(supabase: SupabaseClient, callerId: string): Promise<string> {
  const membership = await getActiveTeamMembershipForUser(supabase, callerId);
  return membership?.ownerUserId ?? callerId;
}
