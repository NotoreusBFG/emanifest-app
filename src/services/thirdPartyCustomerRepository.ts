import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";

export type CustomerConnectionStatus = "pending" | "approved" | "declined" | "revoked";

export interface ThirdPartyCustomer {
  id: string;
  epaSiteId: string;
  siteName: string;
  siteAddress: string;
  pocEmail: string;
  thirdPartyEmail: string;
  status: CustomerConnectionStatus;
  approvalToken: string;
  requestedAt: string;
  respondedAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
}

function mapRow(row: Record<string, unknown>): ThirdPartyCustomer {
  return {
    id: row.id as string,
    epaSiteId: row.epa_site_id as string,
    siteName: (row.site_name as string) ?? "",
    siteAddress: (row.site_address as string) ?? "",
    pocEmail: row.poc_email as string,
    thirdPartyEmail: (row.third_party_email as string) ?? "",
    status: row.status as CustomerConnectionStatus,
    approvalToken: row.approval_token as string,
    requestedAt: row.requested_at as string,
    respondedAt: (row.responded_at as string) ?? null,
    expiresAt: row.expires_at as string,
    revokedAt: (row.revoked_at as string) ?? null,
  };
}

export async function createCustomerConnectionRequest(
  supabase: SupabaseClient,
  thirdPartyUserId: string,
  thirdPartyEmail: string,
  epaSiteId: string,
  siteName: string,
  siteAddress: string,
  pocEmail: string
): Promise<{ success: true; customer: ThirdPartyCustomer } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("third_party_customers")
    .insert({
      third_party_user_id: thirdPartyUserId,
      third_party_email: thirdPartyEmail,
      epa_site_id: epaSiteId,
      site_name: siteName,
      site_address: siteAddress,
      poc_email: pocEmail.trim().toLowerCase(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "You already have a pending or approved request for this site." };
    }
    console.error("createCustomerConnectionRequest failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true, customer: mapRow(data) };
}

export async function listCustomersForThirdParty(
  supabase: SupabaseClient,
  thirdPartyUserId: string
): Promise<ThirdPartyCustomer[]> {
  const { data, error } = await supabase
    .from("third_party_customers")
    .select("*")
    .eq("third_party_user_id", thirdPartyUserId)
    .order("requested_at", { ascending: false });

  if (error) {
    console.error("listCustomersForThirdParty failed:", describePostgrestError(error));
    return [];
  }
  return (data ?? []).map(mapRow);
}

/** Only approved connections -- used by LockedGeneratorSelect's
 * third_party source to restrict the generator picker. */
export async function listApprovedCustomers(
  supabase: SupabaseClient,
  thirdPartyUserId: string
): Promise<ThirdPartyCustomer[]> {
  const { data, error } = await supabase
    .from("third_party_customers")
    .select("*")
    .eq("third_party_user_id", thirdPartyUserId)
    .eq("status", "approved")
    .order("site_name", { ascending: true });

  if (error) {
    console.error("listApprovedCustomers failed:", describePostgrestError(error));
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function revokeCustomerConnection(
  supabase: SupabaseClient,
  thirdPartyUserId: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("third_party_customers")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("third_party_user_id", thirdPartyUserId);

  if (error) {
    console.error("revokeCustomerConnection failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Generator-facing: approved third parties connected to sites this
 * generator manages -- powered by the "Generators can view approved
 * connections for their sites" RLS policy (matched via their own
 * generator_managed_sites rows, not a direct FK). */
export async function listApprovedConnectionsForSite(
  supabase: SupabaseClient,
  epaSiteId: string
): Promise<ThirdPartyCustomer[]> {
  const { data, error } = await supabase
    .from("third_party_customers")
    .select("*")
    .eq("epa_site_id", epaSiteId)
    .eq("status", "approved");

  if (error) {
    console.error("listApprovedConnectionsForSite failed:", describePostgrestError(error));
    return [];
  }
  return (data ?? []).map(mapRow);
}

export interface ConnectionRequestPublicInfo {
  siteName: string;
  epaSiteId: string;
  siteAddress: string;
  thirdPartyEmail: string;
  status: CustomerConnectionStatus;
  expiresAt: string;
}

/** Anonymous-safe read via the get_customer_connection_request() RPC --
 * see that function's comment for why this can't just be a table select. */
export async function getConnectionRequestByToken(
  supabase: SupabaseClient,
  token: string
): Promise<ConnectionRequestPublicInfo | null> {
  const { data, error } = await supabase.rpc("get_customer_connection_request", { p_token: token });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    siteName: row.site_name,
    epaSiteId: row.epa_site_id,
    siteAddress: row.site_address,
    thirdPartyEmail: row.third_party_email,
    status: row.status,
    expiresAt: row.expires_at,
  };
}

/** Anonymous-safe write via the respond_to_customer_connection() RPC --
 * only path to approved/declined, see that function's comment. */
export async function respondToConnectionRequest(
  supabase: SupabaseClient,
  token: string,
  approve: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("respond_to_customer_connection", {
    p_token: token,
    p_approve: approve,
  });
  if (error) {
    console.error("respondToConnectionRequest failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true };
}
