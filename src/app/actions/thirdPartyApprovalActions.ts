"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getConnectionRequestByToken,
  respondToConnectionRequest,
  type ConnectionRequestPublicInfo,
} from "@/services/thirdPartyCustomerRepository";
import { addManagedSite } from "@/services/generatorSiteRepository";

export async function getCustomerConnectionRequestAction(token: string): Promise<ConnectionRequestPublicInfo | null> {
  const supabase = await createClient();
  return getConnectionRequestByToken(supabase, token);
}

export type RespondActionState = { success: true } | { success: false; error: string } | null;

/** No login required to approve/decline -- see get_customer_connection_request's
 * migration comment for the trust model (link-possession, same as
 * generator_sign_tokens). */
export async function respondToCustomerConnectionAction(
  token: string,
  approve: boolean
): Promise<RespondActionState> {
  const supabase = await createClient();
  const result = await respondToConnectionRequest(supabase, token, approve);
  if (!result.success) return { success: false, error: result.error ?? "Failed to respond." };
  return { success: true };
}

export type ClaimActionState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null;

/**
 * Post-approval, post-signup convergence: a generator who approved a
 * connection but had no ManifestMate account can create one, then come
 * back to the same approval link (now logged in) to claim the site into
 * their own generator_managed_sites -- using the site name/address
 * already captured on the connection request, so they don't redo
 * onboarding's EPA-ID step for a site that's already known. Requires the
 * connection to actually be approved; does nothing to the third party's
 * access either way.
 */
export async function claimApprovedSiteAction(
  prevState: ClaimActionState,
  formData: FormData
): Promise<ClaimActionState> {
  const token = formData.get("token") as string;
  if (!token) return { success: false, error: "Missing token." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const info = await getConnectionRequestByToken(supabase, token);
  if (!info) return { success: false, error: "This link isn't valid." };
  if (info.status !== "approved") {
    return { success: false, error: "This connection hasn't been approved yet." };
  }

  const result = await addManagedSite(supabase, user.id, info.epaSiteId, info.siteName, info.siteAddress);
  if (!result.success) return { success: false, error: result.error };

  return { success: true, message: `${info.siteName} added to your generator sites.` };
}
