import type { SupabaseClient } from "@supabase/supabase-js";

export interface TransporterRegistrationSession {
  epaSiteId: string;
  companyNameSnapshot: string | null;
  manifestEpaMtn: string | null;
  expiresAt: string;
}

/** Anonymous-facing read of the display snapshot — never claims/burns the token. See get_transporter_registration_session's comment for why. */
export async function getTransporterRegistrationSession(
  supabase: SupabaseClient,
  token: string
): Promise<TransporterRegistrationSession | null> {
  const { data, error } = await supabase.rpc("get_transporter_registration_session", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    epaSiteId: row.epa_site_id,
    companyNameSnapshot: row.company_name_snapshot,
    manifestEpaMtn: row.manifest_epa_mtn,
    expiresAt: row.expires_at,
  };
}

export interface ClaimedTransporterRegistrationToken {
  tokenId: string;
  epaSiteId: string;
  companyNameSnapshot: string | null;
  createdByUserId: string;
  ownerNotifyEmail: string | null;
  manifestEpaMtn: string | null;
  /** For the post-registration confirmation, sent over every channel actually used at invite time. */
  recipientPhone: string | null;
  recipientEmail: string | null;
}

/**
 * Atomically marks the token used — must be called BEFORE the live
 * RCRAInfo credential check, not after, to close the double-submit race a
 * naive "check then act" sequence would leave open. Returns null if the
 * token is already used, expired, or has hit the failed-attempt cap. Call
 * releaseTransporterRegistrationToken on failure to allow retry.
 */
export async function claimTransporterRegistrationToken(
  supabase: SupabaseClient,
  token: string
): Promise<ClaimedTransporterRegistrationToken | null> {
  const { data, error } = await supabase.rpc("claim_transporter_registration_token", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    tokenId: row.token_id,
    epaSiteId: row.epa_site_id,
    companyNameSnapshot: row.company_name_snapshot,
    createdByUserId: row.created_by_user_id,
    ownerNotifyEmail: row.owner_notify_email ?? null,
    manifestEpaMtn: row.manifest_epa_mtn ?? null,
    recipientPhone: row.recipient_phone ?? null,
    recipientEmail: row.recipient_email ?? null,
  };
}

export async function releaseTransporterRegistrationToken(supabase: SupabaseClient, tokenId: string): Promise<void> {
  const { error } = await supabase.rpc("release_transporter_registration_token", { p_token_id: tokenId });
  if (error) console.error("releaseTransporterRegistrationToken failed:", error.message);
}

/**
 * Writes the claimed token's registration into `transporters` — keyed
 * server-side on the claimed token id, never a caller-supplied
 * epa_site_id. See complete_transporter_registration's migration comment
 * for why this is the highest-risk function in this feature.
 */
export interface CompletedTransporterRegistration {
  transporterId: string;
  managementToken: string;
}

export async function completeTransporterRegistration(
  supabase: SupabaseClient,
  params: {
    tokenId: string;
    companyName: string;
    encryptedApiId: string;
    encryptedApiKey: string;
    pinHash: string;
  }
): Promise<CompletedTransporterRegistration> {
  const { data, error } = await supabase.rpc("complete_transporter_registration", {
    p_token_id: params.tokenId,
    p_company_name: params.companyName,
    p_epa_api_id_encrypted: params.encryptedApiId,
    p_epa_api_key_encrypted: params.encryptedApiKey,
    p_pin_hash: params.pinHash,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row?.transporter_id || !row?.management_token) {
    throw new Error("Failed to complete transporter registration.");
  }
  return { transporterId: row.transporter_id, managementToken: row.management_token };
}

export interface CreateTransporterRegistrationTokenParams {
  epaSiteId: string;
  companyName: string | null;
  manifestEpaMtn: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  ownerNotifyEmail: string | null;
}

/** Generator-facing — auth.uid() is checked and used server-side inside create_transporter_registration_token, so a caller can't spoof another user's id. */
export async function createTransporterRegistrationToken(
  supabase: SupabaseClient,
  params: CreateTransporterRegistrationTokenParams
): Promise<string> {
  const { data, error } = await supabase.rpc("create_transporter_registration_token", {
    p_epa_site_id: params.epaSiteId,
    p_company_name: params.companyName,
    p_manifest_epa_mtn: params.manifestEpaMtn,
    p_recipient_phone: params.recipientPhone,
    p_recipient_email: params.recipientEmail,
    p_owner_notify_email: params.ownerNotifyEmail,
  });
  if (error) throw new Error(error.message);
  const token = data?.[0]?.token;
  if (!token) throw new Error("Failed to create transporter registration invite.");
  return token;
}

/** Generator-facing: distinguishes "never invited" from "invited, awaiting completion" for the SendForSignature.tsx CTA. */
export async function hasPendingTransporterInvite(supabase: SupabaseClient, epaSiteId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_pending_transporter_invite", { p_epa_site_id: epaSiteId });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export interface TransporterManagementSession {
  companyName: string | null;
  epaSiteId: string;
  revokedAt: string | null;
  pinSetAt: string | null;
}

/** Anonymous-facing read for the /manage-transporter/[managementToken] page. */
export async function getTransporterManagementSession(
  supabase: SupabaseClient,
  managementToken: string
): Promise<TransporterManagementSession | null> {
  const { data, error } = await supabase.rpc("get_transporter_management_session", {
    p_management_token: managementToken,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    companyName: row.company_name,
    epaSiteId: row.epa_site_id,
    revokedAt: row.revoked_at,
    pinSetAt: row.pin_set_at,
  };
}

export async function revokeTransporterByManagementToken(supabase: SupabaseClient, managementToken: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_transporter_by_management_token", {
    p_management_token: managementToken,
  });
  if (error) throw new Error(error.message);
}

export async function unrevokeTransporterByManagementToken(supabase: SupabaseClient, managementToken: string): Promise<void> {
  const { error } = await supabase.rpc("unrevoke_transporter_by_management_token", {
    p_management_token: managementToken,
  });
  if (error) throw new Error(error.message);
}

export async function updateTransporterPinByManagementToken(
  supabase: SupabaseClient,
  managementToken: string,
  pinHash: string
): Promise<void> {
  const { error } = await supabase.rpc("update_transporter_pin_by_management_token", {
    p_management_token: managementToken,
    p_pin_hash: pinHash,
  });
  if (error) throw new Error(error.message);
}
