"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createCustomerConnectionRequest,
  listCustomersForThirdParty,
  revokeCustomerConnection,
  listApprovedConnectionsForSite,
  listApprovedCustomers,
  type ThirdPartyCustomer,
} from "@/services/thirdPartyCustomerRepository";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email/resendClient";

export type CustomerActionState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null;

/**
 * Third party searches EPA for a prospective generator (the one place a
 * free site search stays -- there's no existing list to restrict to for a
 * brand-new prospect), confirms/edits the POC email, and this creates a
 * pending connection request plus emails that POC an approval link.
 * Approving grants creation-only access -- explicit in the email copy,
 * since it's a common point of confusion with full account access.
 */
export async function requestCustomerConnectionAction(
  prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const epaSiteId = ((formData.get("epaSiteId") as string) ?? "").trim().toUpperCase();
  const siteName = ((formData.get("siteName") as string) ?? "").trim();
  const siteAddress = ((formData.get("siteAddress") as string) ?? "").trim();
  const pocEmail = ((formData.get("pocEmail") as string) ?? "").trim();

  if (!epaSiteId || !siteName) return { success: false, error: "Select a generator site first." };
  if (!pocEmail) return { success: false, error: "Enter the generator's point-of-contact email." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await createCustomerConnectionRequest(
    supabase,
    user.id,
    user.email ?? "",
    epaSiteId,
    siteName,
    siteAddress,
    pocEmail
  );
  if (!result.success) return { success: false, error: result.error };

  const headersList = await headers();
  const origin = headersList.get("origin") ?? headersList.get("x-forwarded-host") ?? "";
  const approveUrl = `${origin}/third-party/approve?token=${result.customer.approvalToken}`;
  const thirdPartyLabel = user.email ?? "A ManifestMate user";

  try {
    await sendEmail(
      pocEmail,
      `${thirdPartyLabel} requests access to your ManifestMate account`,
      `${thirdPartyLabel} has asked to be able to create manifests, waste profiles, and labels in ` +
        `ManifestMate for ${siteName} (EPA ID ${epaSiteId}).\n\n` +
        `Approving only lets them CREATE these records on your behalf -- they cannot sign anything as ` +
        `you unless you separately invite them as a Quick-Sign delegate later.\n\n` +
        `Review and respond here (no account needed): ${approveUrl}\n\n` +
        `This link expires in 7 days.`
    );
  } catch (err) {
    if (!(err instanceof EmailNotConfiguredError)) {
      console.error("Customer connection request email failed (non-fatal):", err);
    }
    revalidatePath("/settings");
    return {
      success: true,
      message: `Request created, but the email couldn't be sent automatically. Send this link to ${pocEmail} yourself: ${approveUrl}`,
    };
  }

  revalidatePath("/settings");
  return { success: true, message: `Approval request emailed to ${pocEmail}.` };
}

export async function listMyCustomersAction(): Promise<ThirdPartyCustomer[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listCustomersForThirdParty(supabase, user.id);
}

/** Only approved customers -- feeds LockedGeneratorSelect's third_party
 * source, restricting the generator picker to this list. */
export async function listMyApprovedCustomersAction(): Promise<ThirdPartyCustomer[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listApprovedCustomers(supabase, user.id);
}

/** Generator-facing: which approved third parties can currently create
 * records for this site of theirs -- powered by the "Generators can view
 * approved connections for their sites" RLS policy. */
export async function listConnectedThirdPartiesForSiteAction(epaSiteId: string): Promise<ThirdPartyCustomer[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listApprovedConnectionsForSite(supabase, epaSiteId);
}

export async function revokeCustomerConnectionAction(connectionId: string): Promise<CustomerActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await revokeCustomerConnection(supabase, user.id, connectionId);
  if (!result.success) return { success: false, error: result.error ?? "Failed to revoke." };

  revalidatePath("/settings");
  return { success: true, message: "Connection revoked." };
}
