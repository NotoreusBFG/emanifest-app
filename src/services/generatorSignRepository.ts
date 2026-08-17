import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/cryptoUtils";

export interface GeneratorSignSession {
  epaMtn: string;
  generatorName: string | null;
  tsdfName: string | null;
  wasteLineSummary: string | null;
  expiresAt: string;
}

/** Anonymous-facing read of the display snapshot — never claims/burns the token. See get_generator_sign_session's comment for why. */
export async function getGeneratorSignSession(
  supabase: SupabaseClient,
  token: string
): Promise<GeneratorSignSession | null> {
  const { data, error } = await supabase.rpc("get_generator_sign_session", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    epaMtn: row.epa_mtn,
    generatorName: row.generator_name,
    tsdfName: row.tsdf_name,
    wasteLineSummary: row.waste_line_summary,
    expiresAt: row.expires_at,
  };
}

export interface ClaimedGeneratorSignToken {
  tokenId: string;
  ownerUserId: string;
  epaMtn: string;
  /** For the post-signature confirmation, sent over every channel actually used at creation time. */
  recipientPhone: string | null;
  recipientEmail: string | null;
}

/**
 * Atomically marks the token used — must be called BEFORE the RCRAInfo
 * sign call, not after, to close the double-submit race a naive
 * "check then act" sequence would leave open. Returns null if the token
 * is already used, expired, or has hit the failed-attempt cap. Call
 * releaseGeneratorSignToken on failure to allow retry.
 */
export async function claimGeneratorSignToken(
  supabase: SupabaseClient,
  token: string
): Promise<ClaimedGeneratorSignToken | null> {
  const { data, error } = await supabase.rpc("claim_generator_sign_token", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    tokenId: row.token_id,
    ownerUserId: row.owner_user_id,
    epaMtn: row.epa_mtn,
    recipientPhone: row.recipient_phone ?? null,
    recipientEmail: row.recipient_email ?? null,
  };
}

export async function releaseGeneratorSignToken(supabase: SupabaseClient, tokenId: string): Promise<void> {
  const { error } = await supabase.rpc("release_generator_sign_token", { p_token_id: tokenId });
  if (error) console.error("releaseGeneratorSignToken failed:", error.message);
}

export interface OwnerCredentials {
  apiId: string;
  apiKey: string;
}

/**
 * Decrypted owner credentials for an already-claimed token — keyed on
 * the TOKEN ID (not a bare owner user id), and only returns anything
 * while the token is actually claimed (`used_at is not null`). See
 * get_owner_credentials_for_token's migration comment for why this is
 * more sensitive than the analogous driver-sign lookup and must never
 * be keyed on owner_user_id directly.
 */
export async function getOwnerCredentialsForToken(
  supabase: SupabaseClient,
  tokenId: string
): Promise<OwnerCredentials | null> {
  const { data, error } = await supabase.rpc("get_owner_credentials_for_token", { p_token_id: tokenId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    apiId: decrypt(row.epa_api_id),
    apiKey: decrypt(row.epa_api_key),
  };
}

/**
 * Deliberately separate from getOwnerCredentialsForToken, mirroring
 * getManifestMmin in driverSignRepository.ts — keyed on the CLAIMED token
 * id, never a bare id. Returns the decrypted 4-digit MMIN, or null if this
 * manifest hasn't been assigned one yet.
 */
export async function getManifestMminForGeneratorToken(supabase: SupabaseClient, tokenId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_mmin_for_claimed_generator_token", { p_token_id: tokenId });
  if (error) throw new Error(error.message);
  const mminEncrypted = data?.[0]?.mmin_encrypted ?? null;
  return mminEncrypted ? decrypt(mminEncrypted) : null;
}

export interface RecordGeneratorSignResultParams {
  tokenId: string;
  epaMtn: string;
  siteId: string;
  signerName: string;
  certificationHeading: string;
  certificationText: string;
  certificationIsVerbatim: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  signSucceeded: boolean;
  epaReportId?: string;
  epaError?: string;
  mminVerified: boolean;
}

/** Always called, success or failure — mirrors signManifestAction/submitDriverSignAction's "record the attempt either way" behavior. */
export async function recordGeneratorSignResult(
  supabase: SupabaseClient,
  params: RecordGeneratorSignResultParams
): Promise<void> {
  const { error } = await supabase.rpc("record_generator_sign_result", {
    p_token_id: params.tokenId,
    p_epa_mtn: params.epaMtn,
    p_site_id: params.siteId,
    p_signer_name: params.signerName,
    p_certification_heading: params.certificationHeading,
    p_certification_text: params.certificationText,
    p_certification_is_verbatim: params.certificationIsVerbatim,
    p_ip_address: params.ipAddress,
    p_user_agent: params.userAgent,
    p_sign_succeeded: params.signSucceeded,
    p_epa_report_id: params.epaReportId ?? null,
    p_epa_error: params.epaError ?? null,
    p_mmin_verified: params.mminVerified,
  });
  if (error) console.error("recordGeneratorSignResult FAILED — audit trail gap:", error.message);
}

export async function updateManifestGeneratorSignedAt(
  supabase: SupabaseClient,
  userId: string,
  epaMtn: string,
  signedAt: string
): Promise<void> {
  const { error } = await supabase.rpc("update_manifest_generator_signed_at", {
    p_user_id: userId,
    p_epa_mtn: epaMtn,
    p_generator_signed_at: signedAt,
  });
  if (error) console.error("updateManifestGeneratorSignedAt failed (non-fatal):", error.message);
}

export interface CreateGeneratorSignTokenParams {
  manifestEpaMtn: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  generatorName: string | null;
  tsdfName: string | null;
  wasteLineSummary: string | null;
}

/** Owner-facing — auth.uid() is checked and used server-side inside create_generator_sign_token, so a caller can't spoof another user's id. */
export async function createGeneratorSignToken(
  supabase: SupabaseClient,
  params: CreateGeneratorSignTokenParams
): Promise<string> {
  const { data, error } = await supabase.rpc("create_generator_sign_token", {
    p_manifest_epa_mtn: params.manifestEpaMtn,
    p_recipient_phone: params.recipientPhone,
    p_recipient_email: params.recipientEmail,
    p_generator_name: params.generatorName,
    p_tsdf_name: params.tsdfName,
    p_waste_line_summary: params.wasteLineSummary,
  });
  if (error) throw new Error(error.message);
  const token = data?.[0]?.token;
  if (!token) throw new Error("Failed to create generator sign link.");
  return token;
}
