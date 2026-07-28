import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/cryptoUtils";

export interface DriverSignSession {
  epaMtn: string;
  transporterOrder: number;
  generatorName: string | null;
  tsdfName: string | null;
  wasteLineSummary: string | null;
  expiresAt: string;
}

/** Anonymous-facing read of the display snapshot — never claims/burns the token. See get_driver_sign_session's comment for why. */
export async function getDriverSignSession(
  supabase: SupabaseClient,
  token: string
): Promise<DriverSignSession | null> {
  const { data, error } = await supabase.rpc("get_driver_sign_session", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    epaMtn: row.epa_mtn,
    transporterOrder: row.transporter_order,
    generatorName: row.generator_name,
    tsdfName: row.tsdf_name,
    wasteLineSummary: row.waste_line_summary,
    expiresAt: row.expires_at,
  };
}

export interface ClaimedDriverSignToken {
  tokenId: string;
  transporterId: string;
  transporterOrder: number;
  epaMtn: string;
  createdByUserId: string;
}

/**
 * Atomically marks the token used — must be called BEFORE the RCRAInfo
 * sign call, not after, to close the double-submit race a naive
 * "check then act" sequence would leave open. Returns null if the token
 * is already used, expired, or has hit the failed-attempt cap. Call
 * releaseDriverSignToken on failure to allow retry.
 */
export async function claimDriverSignToken(
  supabase: SupabaseClient,
  token: string
): Promise<ClaimedDriverSignToken | null> {
  const { data, error } = await supabase.rpc("claim_driver_sign_token", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    tokenId: row.token_id,
    transporterId: row.transporter_id,
    transporterOrder: row.transporter_order,
    epaMtn: row.epa_mtn,
    createdByUserId: row.created_by_user_id,
  };
}

export async function releaseDriverSignToken(supabase: SupabaseClient, tokenId: string): Promise<void> {
  const { error } = await supabase.rpc("release_driver_sign_token", { p_token_id: tokenId });
  if (error) console.error("releaseDriverSignToken failed:", error.message);
}

export interface TransporterCredentials {
  epaSiteId: string;
  apiId: string;
  apiKey: string;
}

/** Decrypted transporter credentials for an already-claimed token's transporter — re-checks revoked_at live inside the SQL function. */
export async function getTransporterCredentials(
  supabase: SupabaseClient,
  transporterId: string
): Promise<TransporterCredentials | null> {
  const { data, error } = await supabase.rpc("get_transporter_credentials", {
    p_transporter_id: transporterId,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    epaSiteId: row.epa_site_id,
    apiId: decrypt(row.epa_api_id),
    apiKey: decrypt(row.epa_api_key),
  };
}

export interface RecordDriverSignResultParams {
  tokenId: string;
  epaMtn: string;
  transporterOrder: number;
  siteId: string;
  driverName: string;
  driverIdNumber?: string;
  truckNumber?: string;
  certificationHeading: string;
  certificationText: string;
  certificationIsVerbatim: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  signSucceeded: boolean;
  epaReportId?: string;
  epaError?: string;
}

/** Always called, success or failure — mirrors signManifestAction's "record the attempt either way" behavior in manifestActions.ts. */
export async function recordDriverSignResult(
  supabase: SupabaseClient,
  params: RecordDriverSignResultParams
): Promise<void> {
  const { error } = await supabase.rpc("record_driver_sign_result", {
    p_token_id: params.tokenId,
    p_epa_mtn: params.epaMtn,
    p_transporter_order: params.transporterOrder,
    p_site_id: params.siteId,
    p_driver_name: params.driverName,
    p_driver_id_number: params.driverIdNumber ?? null,
    p_truck_number: params.truckNumber ?? null,
    p_certification_heading: params.certificationHeading,
    p_certification_text: params.certificationText,
    p_certification_is_verbatim: params.certificationIsVerbatim,
    p_ip_address: params.ipAddress,
    p_user_agent: params.userAgent,
    p_sign_succeeded: params.signSucceeded,
    p_epa_report_id: params.epaReportId ?? null,
    p_epa_error: params.epaError ?? null,
  });
  if (error) console.error("recordDriverSignResult FAILED — audit trail gap:", error.message);
}

export async function updateManifestTransporterSignedAt(
  supabase: SupabaseClient,
  userId: string,
  epaMtn: string,
  signedAt: string
): Promise<void> {
  const { error } = await supabase.rpc("update_manifest_transporter_signed_at", {
    p_user_id: userId,
    p_epa_mtn: epaMtn,
    p_transporter_signed_at: signedAt,
  });
  if (error) console.error("updateManifestTransporterSignedAt failed (non-fatal):", error.message);
}

export interface CreateDriverSignTokenParams {
  manifestEpaMtn: string;
  transporterId: string;
  transporterOrder: number;
  generatorName: string | null;
  tsdfName: string | null;
  wasteLineSummary: string | null;
}

/** Generator-facing — auth.uid() is checked and used server-side inside create_driver_sign_token, so a caller can't spoof another user's id. */
export async function createDriverSignToken(
  supabase: SupabaseClient,
  params: CreateDriverSignTokenParams
): Promise<string> {
  const { data, error } = await supabase.rpc("create_driver_sign_token", {
    p_manifest_epa_mtn: params.manifestEpaMtn,
    p_transporter_id: params.transporterId,
    p_transporter_order: params.transporterOrder,
    p_generator_name: params.generatorName,
    p_tsdf_name: params.tsdfName,
    p_waste_line_summary: params.wasteLineSummary,
  });
  if (error) throw new Error(error.message);
  const token = data?.[0]?.token;
  if (!token) throw new Error("Failed to create driver sign link.");
  return token;
}
