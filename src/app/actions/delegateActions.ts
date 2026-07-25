"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createDelegateInvite,
  listDelegatesForOwner,
  revokeDelegate,
  getPendingInviteByToken,
  acceptDelegateInvite,
  getActiveDelegationForUser,
  type DelegateRecord,
  type DelegateSiteType,
} from "@/services/delegateRepository";

export type DelegateActionState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null;

/** Owner enters an email + which roles to allow; gets back a shareable
 * accept link. No transactional email is sent — this project has no email
 * provider configured, so the owner copies/sends the link themselves (see
 * docs/delegate-quick-sign-design.md and the migration's header comment). */
export async function inviteDelegateAction(
  prevState: DelegateActionState,
  formData: FormData
): Promise<DelegateActionState> {
  const email = (formData.get("invitedEmail") as string)?.trim();
  if (!email) return { success: false, error: "Enter an email address to invite." };

  const allowedSiteTypes = formData.getAll("allowedSiteTypes") as DelegateSiteType[];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };
  if (!user.email) return { success: false, error: "Your account has no email on file." };

  if (email.toLowerCase() === user.email.toLowerCase()) {
    return { success: false, error: "You can't invite yourself." };
  }

  const result = await createDelegateInvite(
    supabase,
    user.id,
    user.email,
    email,
    allowedSiteTypes.length > 0 ? allowedSiteTypes : null
  );

  if (!result.success) return { success: false, error: result.error };

  const headersList = await headers();
  const origin = headersList.get("origin") ?? headersList.get("x-forwarded-host") ?? "";
  const acceptUrl = `${origin}/delegate/accept?token=${result.inviteToken}`;

  revalidatePath("/settings");
  return {
    success: true,
    message: `Invite created. Send this link to ${email}: ${acceptUrl}`,
  };
}

export async function listMyDelegatesAction(): Promise<DelegateRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listDelegatesForOwner(supabase, user.id);
}

export async function revokeDelegateAction(delegateRowId: string): Promise<DelegateActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await revokeDelegate(supabase, user.id, delegateRowId);
  if (!result.success) return { success: false, error: result.error ?? "Failed to revoke." };

  revalidatePath("/settings");
  return { success: true, message: "Access revoked." };
}

/** Whether the *current* user is themselves an active delegate for someone
 * else — used by the sign confirmation dialog to show "on behalf of X." */
export async function getMyDelegationStatusAction(): Promise<{ ownerEmail: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const delegation = await getActiveDelegationForUser(supabase, user.id);
  return delegation ? { ownerEmail: delegation.ownerEmail } : null;
}

export type AcceptInviteState =
  | { status: "not-logged-in"; ownerEmail: string; invitedEmail: string }
  | { status: "wrong-account"; ownerEmail: string; invitedEmail: string; currentEmail: string }
  // Covers not-found, already-accepted, and revoked alike — the RLS-backed
  // lookup can't distinguish these from "no such invite" without leaking
  // information to whoever holds the link, so they all render the same way.
  | { status: "not-found" }
  | { status: "ready"; ownerEmail: string };

export async function getInviteStatusAction(token: string): Promise<AcceptInviteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated lookups can't rely on RLS (which requires a matching
  // logged-in email) -- if there's no user yet, we can't confirm the invite
  // is real without leaking it to anyone with the link, so we only tell an
  // anonymous visitor "log in to view this invite," never its details.
  if (!user) {
    return { status: "not-logged-in", ownerEmail: "", invitedEmail: "" };
  }

  const invite = await getPendingInviteByToken(supabase, token);
  if (!invite) {
    // Either genuinely not found, already accepted/revoked, or (per RLS)
    // addressed to a different email than the logged-in user's.
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

export async function acceptInviteAction(
  prevState: DelegateActionState,
  formData: FormData
): Promise<DelegateActionState> {
  const token = formData.get("token") as string;
  if (!token) return { success: false, error: "Missing invite token." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await acceptDelegateInvite(supabase, token, user.id);
  if (!result.success) return { success: false, error: result.error ?? "Failed to accept invite." };

  return { success: true, message: "You can now Quick-Sign on their behalf." };
}
