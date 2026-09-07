"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createTeamInvite,
  listTeamForOwner,
  revokeTeamMember,
  getPendingTeamInviteByToken,
  acceptTeamInvite,
  getActiveTeamMembershipForUser,
  type TeamMemberRecord,
} from "@/services/teamRepository";

export type TeamActionState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null;

/** Owner enters an email; gets back a shareable accept link (same
 * no-email-provider-for-this-specific-flow reasoning as
 * docs/delegate-quick-sign-design.md -- the owner copies/sends it
 * themselves). */
export async function inviteTeamMemberAction(
  prevState: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const email = (formData.get("invitedEmail") as string)?.trim();
  if (!email) return { success: false, error: "Enter an email address to invite." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };
  if (!user.email) return { success: false, error: "Your account has no email on file." };

  if (email.toLowerCase() === user.email.toLowerCase()) {
    return { success: false, error: "You can't invite yourself." };
  }

  const result = await createTeamInvite(supabase, user.id, user.email, email);
  if (!result.success) return { success: false, error: result.error };

  const headersList = await headers();
  const origin = headersList.get("origin") ?? headersList.get("x-forwarded-host") ?? "";
  const acceptUrl = `${origin}/team/accept?token=${result.inviteToken}`;

  revalidatePath("/settings");
  return {
    success: true,
    message: `Invite created. Send this link to ${email}: ${acceptUrl}`,
  };
}

export async function listMyTeamAction(): Promise<TeamMemberRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listTeamForOwner(supabase, user.id);
}

export async function revokeTeamMemberAction(teamMemberRowId: string): Promise<TeamActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await revokeTeamMember(supabase, user.id, teamMemberRowId);
  if (!result.success) return { success: false, error: result.error ?? "Failed to remove." };

  revalidatePath("/settings");
  return { success: true, message: "Removed from team." };
}

/** Whether the *current* user is themselves an active team member of
 * someone else -- used for the "you're working in X's workspace" banner. */
export async function getMyTeamMembershipStatusAction(): Promise<{ ownerEmail: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = await getActiveTeamMembershipForUser(supabase, user.id);
  return membership ? { ownerEmail: membership.ownerEmail } : null;
}

export type TeamInviteStatus =
  | { status: "not-logged-in"; ownerEmail: string; invitedEmail: string }
  | { status: "wrong-account"; ownerEmail: string; invitedEmail: string; currentEmail: string }
  | { status: "not-found" }
  | { status: "ready"; ownerEmail: string };

export async function getTeamInviteStatusAction(token: string): Promise<TeamInviteStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "not-logged-in", ownerEmail: "", invitedEmail: "" };
  }

  const invite = await getPendingTeamInviteByToken(supabase, token);
  if (!invite) {
    return { status: "not-found" };
  }

  if (user.email && invite.invited_email.toLowerCase() !== user.email.toLowerCase()) {
    return {
      status: "wrong-account",
      ownerEmail: invite.owner_email,
      invitedEmail: invite.invited_email,
      currentEmail: user.email,
    };
  }

  return { status: "ready", ownerEmail: invite.owner_email };
}

export async function acceptTeamInviteAction(
  prevState: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const token = formData.get("token") as string;
  if (!token) return { success: false, error: "Missing invite token." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await acceptTeamInvite(supabase, token, user.id);
  if (!result.success) return { success: false, error: result.error ?? "Failed to accept invite." };

  return { success: true, message: "You're now on their team." };
}
