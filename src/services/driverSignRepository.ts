import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/cryptoUtils";

export interface DriverSignSession {
  epaMtn: string;
  transporterOrder: number;
  generatorName: string | null;
  tsdfName: string | null;
  wasteLineSummary: string | null;
  expiresAt: string;
  transporterCompanyName: string | null;
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
    transporterCompanyName: row.transporter_company_name,
  };
}

export interface ClaimedDriverSignToken {
  tokenId: string;
  transporterId: string;
  transporterOrder: number;
  epaMtn: string;
  createdByUserId: string;
  /** For the post-signature confirmation text — see submitDriverSignAction. Null for tokens created before this column existed. */
  driverPhone: string | null;
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
    driverPhone: row.driver_phone ?? null,
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

/**
 * Deliberately separate from getTransporterCredentials — that function
 * takes a bare transporter_id (no token/claim check), which is fine there
 * only because epa_api_id/epa_api_key are AES-encrypted and useless
 * without the server-only ENCRYPTION_SECRET_KEY. This is keyed on the
 * CLAIMED token id instead, same get_owner_credentials_for_token-class
 * pattern as the old PIN check it replaces (see
 * 20260813_fix_pin_hash_exposure.sql, 20260824_add_mmin_to_manifests.sql).
 * Returns the decrypted 4-digit MMIN, or null if this manifest hasn't been
 * assigned one yet.
 */
export async function getManifestMmin(supabase: SupabaseClient, tokenId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_mmin_for_claimed_token", {
    p_token_id: tokenId,
  });
  if (error) throw new Error(error.message);
  const mminEncrypted = data?.[0]?.mmin_encrypted ?? null;
  return mminEncrypted ? decrypt(mminEncrypted) : null;
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
  /** Frozen historical column — the old company-PIN gate this replaced. Always false post-cutover. */
  pinVerified: boolean;
  mminVerified: boolean;
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
    p_pin_verified: params.pinVerified,
    p_mmin_verified: params.mminVerified,
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
  /** Persisted so a post-signature confirmation text can go back to the same number — see submitDriverSignAction. */
  driverPhone: string;
  /** Persisted so the /sign/[token] page can name the transporter the driver is actually signing on behalf of, not just the generator/facility — see DriverSignForm.tsx. */
  transporterCompanyName: string | null;
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
    p_driver_phone: params.driverPhone,
    p_transporter_company_name: params.transporterCompanyName,
  });
  if (error) throw new Error(error.message);
  const token = data?.[0]?.token;
  if (!token) throw new Error("Failed to create driver sign link.");
  return token;
}

export interface DriverSignInfo {
  driverName: string;
  driverIdNumber: string | null;
  truckNumber: string | null;
  signedAt: string;
}

/**
 * Batched (one query, not one per manifest) lookup of the most recent
 * successful driver signature per manifest — for displaying Driver
 * Name/ID/Truck #/Date on the dashboard and manifest detail page. Reads
 * `signature_consents` directly under normal RLS (the "Generators can
 * view driver-signed consents for their tokens" policy from
 * 20260805_extend_signature_consents_for_driver_sign.sql already permits
 * this for the manifest owner) — no SECURITY DEFINER function needed
 * here, unlike the anonymous driver-facing reads/writes elsewhere in this
 * file.
 */
export async function listDriverSignInfoByMtn(
  supabase: SupabaseClient,
  epaMtns: string[]
): Promise<Record<string, DriverSignInfo>> {
  if (epaMtns.length === 0) return {};

  const { data, error } = await supabase
    .from("signature_consents")
    .select("epa_mtn, printed_signature_name, driver_id_number, truck_number, acknowledged_at")
    .in("epa_mtn", epaMtns)
    .not("driver_sign_token_id", "is", null)
    .eq("sign_succeeded", true)
    .order("acknowledged_at", { ascending: false });

  if (error) {
    console.error("listDriverSignInfoByMtn failed:", error.message);
    return {};
  }

  const map: Record<string, DriverSignInfo> = {};
  for (const row of data ?? []) {
    // Rows arrive newest-first — keep only the first (most recent) one
    // seen per MTN, in case of retries or (eventually) multiple drivers.
    if (map[row.epa_mtn]) continue;
    map[row.epa_mtn] = {
      driverName: row.printed_signature_name,
      driverIdNumber: row.driver_id_number,
      truckNumber: row.truck_number,
      signedAt: row.acknowledged_at,
    };
  }
  return map;
}
