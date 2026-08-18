import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/cryptoUtils";

export interface WasteLineEditSession {
  epaMtn: string;
  generatorName: string | null;
  designatedFacilityName: string | null;
  expiresAt: string;
}

/** Anonymous-facing read of the display snapshot — never claims/burns the token. See get_waste_line_edit_session's comment for why. */
export async function getWasteLineEditSession(
  supabase: SupabaseClient,
  token: string
): Promise<WasteLineEditSession | null> {
  const { data, error } = await supabase.rpc("get_waste_line_edit_session", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    epaMtn: row.epa_mtn,
    generatorName: row.generator_name,
    designatedFacilityName: row.designated_facility_name,
    expiresAt: row.expires_at,
  };
}

export interface ClaimedWasteLineEditToken {
  tokenId: string;
  ownerUserId: string;
  epaMtn: string;
}

/**
 * Atomically marks the token used — must be called BEFORE the MMIN check
 * and the RCRAInfo update call, same double-submit-race reasoning as every
 * other claim_*_token function. Returns null if the token is already used,
 * expired, or has hit the failed-attempt cap. Call releaseWasteLineEditToken
 * on a wrong MMIN to allow retry.
 */
export async function claimWasteLineEditToken(
  supabase: SupabaseClient,
  token: string
): Promise<ClaimedWasteLineEditToken | null> {
  const { data, error } = await supabase.rpc("claim_waste_line_edit_token", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    tokenId: row.token_id,
    ownerUserId: row.owner_user_id,
    epaMtn: row.epa_mtn,
  };
}

export async function releaseWasteLineEditToken(supabase: SupabaseClient, tokenId: string): Promise<void> {
  const { error } = await supabase.rpc("release_waste_line_edit_token", { p_token_id: tokenId });
  if (error) console.error("releaseWasteLineEditToken failed:", error.message);
}

/** Decrypted manifest MMIN for an already-claimed token — keyed on the claimed token id, mirrors getManifestMmin in driverSignRepository.ts. */
export async function getManifestMminForWasteLineToken(supabase: SupabaseClient, tokenId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_mmin_for_claimed_waste_line_token", { p_token_id: tokenId });
  if (error) throw new Error(error.message);
  const mminEncrypted = data?.[0]?.mmin_encrypted ?? null;
  return mminEncrypted ? decrypt(mminEncrypted) : null;
}

export interface OwnerCredentials {
  apiId: string;
  apiKey: string;
}

/** Decrypted owner credentials for an already-claimed token — see get_owner_credentials_for_waste_line_token's migration comment for why this must never be keyed on a bare owner_user_id. */
export async function getOwnerCredentialsForWasteLineToken(
  supabase: SupabaseClient,
  tokenId: string
): Promise<OwnerCredentials | null> {
  const { data, error } = await supabase.rpc("get_owner_credentials_for_waste_line_token", { p_token_id: tokenId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    apiId: decrypt(row.epa_api_id),
    apiKey: decrypt(row.epa_api_key),
  };
}

/** Owner-facing — auth.uid() is checked and used server-side inside create_waste_line_edit_token, so a caller can't spoof another user's id. */
export async function createWasteLineEditToken(
  supabase: SupabaseClient,
  params: {
    manifestEpaMtn: string;
    recipientPhone: string | null;
    recipientEmail: string | null;
    generatorName: string | null;
    designatedFacilityName: string | null;
  }
): Promise<string> {
  const { data, error } = await supabase.rpc("create_waste_line_edit_token", {
    p_manifest_epa_mtn: params.manifestEpaMtn,
    p_recipient_phone: params.recipientPhone,
    p_recipient_email: params.recipientEmail,
    p_generator_name: params.generatorName,
    p_designated_facility_name: params.designatedFacilityName,
  });
  if (error) throw new Error(error.message);
  const token = data?.[0]?.token;
  if (!token) throw new Error("Failed to create waste-line-edit link.");
  return token;
}

export interface RecordManifestEditConsentParams {
  tokenId: string;
  epaMtn: string;
  mminVerified: boolean;
  editSucceeded: boolean;
  epaReportId?: string;
  epaError?: string;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Always called, success or failure — mirrors recordDriverSignResult/recordGeneratorSignResult's "record the attempt either way" behavior. */
export async function recordManifestEditConsent(
  supabase: SupabaseClient,
  params: RecordManifestEditConsentParams
): Promise<void> {
  const { error } = await supabase.rpc("record_manifest_edit_consent", {
    p_waste_line_edit_token_id: params.tokenId,
    p_epa_mtn: params.epaMtn,
    p_mmin_verified: params.mminVerified,
    p_edit_succeeded: params.editSucceeded,
    p_epa_report_id: params.epaReportId ?? null,
    p_epa_error: params.epaError ?? null,
    p_ip_address: params.ipAddress,
    p_user_agent: params.userAgent,
  });
  if (error) console.error("recordManifestEditConsent FAILED — audit trail gap:", error.message);
}
