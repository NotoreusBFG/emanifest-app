import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/cryptoUtils";
import { mapRow as mapWasteProfileRow, type WasteProfile } from "@/services/wasteProfileRepository";
import { mapRow as mapLabPackRow } from "@/services/labPackRepository";
import type { LabPack, LabPackJob } from "@/lib/labPack/types";

export interface WasteLineEditSession {
  epaMtn: string;
  generatorName: string | null;
  designatedFacilityName: string | null;
  expiresAt: string;
  /** Whether this link also grants Generator-role signing power — safe to expose pre-claim (a flag, not sensitive), so the delegate page can warn upfront. */
  allowSign: boolean;
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
    allowSign: row.allow_sign,
  };
}

export interface ClaimedWasteLineEditToken {
  tokenId: string;
  ownerUserId: string;
  epaMtn: string;
  /** Captured at invite-creation time from the logged-in owner's session — for the post-submit "manifest is ready to review" notification. */
  ownerNotifyEmail: string | null;
  /** Whether this link also grants Generator-role signing power. */
  allowSign: boolean;
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
    ownerNotifyEmail: row.owner_notify_email ?? null,
    allowSign: row.allow_sign,
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
    ownerNotifyEmail: string | null;
    allowSign: boolean;
  }
): Promise<string> {
  const { data, error } = await supabase.rpc("create_waste_line_edit_token", {
    p_manifest_epa_mtn: params.manifestEpaMtn,
    p_recipient_phone: params.recipientPhone,
    p_recipient_email: params.recipientEmail,
    p_generator_name: params.generatorName,
    p_designated_facility_name: params.designatedFacilityName,
    p_owner_notify_email: params.ownerNotifyEmail,
    p_allow_sign: params.allowSign,
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

export interface RecordGeneratorSignViaWasteLineTokenParams {
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

/**
 * Records the OPTIONAL Generator-role sign that can happen through this
 * same token when allow_sign is true — a genuine signature_consents row
 * (not manifest_edit_consents, which deliberately has no certification
 * text/printed name), so listGeneratorSignInfoByMtn shows "who signed"
 * accurately for this path too. Mirrors recordGeneratorSignResult exactly,
 * just keyed on waste_line_edit_token_id.
 */
export async function recordGeneratorSignViaWasteLineToken(
  supabase: SupabaseClient,
  params: RecordGeneratorSignViaWasteLineTokenParams
): Promise<void> {
  const { error } = await supabase.rpc("record_generator_sign_via_waste_line_token", {
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
  if (error) console.error("recordGeneratorSignViaWasteLineToken FAILED — audit trail gap:", error.message);
}

/** All of the owner's saved waste profiles -- only callable on an
 * ALREADY-CLAIMED token, same trust boundary as getOwnerCredentialsForWasteLineToken. */
export async function listWasteProfilesForWasteLineToken(
  supabase: SupabaseClient,
  tokenId: string
): Promise<WasteProfile[]> {
  const { data, error } = await supabase.rpc("list_waste_profiles_for_waste_line_token", {
    p_token_id: tokenId,
  });
  if (error) {
    console.error("listWasteProfilesForWasteLineToken failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapWasteProfileRow);
}

/** The owner's unlinked lab pack drums -- same `epa_mtn is null` filter
 * /manifests/new/page.tsx applies client-side. */
export async function listLabPacksForWasteLineToken(supabase: SupabaseClient, tokenId: string): Promise<LabPack[]> {
  const { data, error } = await supabase.rpc("list_lab_packs_for_waste_line_token", { p_token_id: tokenId });
  if (error) {
    console.error("listLabPacksForWasteLineToken failed:", error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => mapLabPackRow(row, []));
}

/** The owner's open (not yet linked) lab pack jobs, with a computed drum count. */
export async function listLabPackJobsForWasteLineToken(
  supabase: SupabaseClient,
  tokenId: string
): Promise<LabPackJob[]> {
  const { data, error } = await supabase.rpc("list_lab_pack_jobs_for_waste_line_token", { p_token_id: tokenId });
  if (error) {
    console.error("listLabPackJobsForWasteLineToken failed:", error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    jobNumber: row.job_number as string,
    jobName: (row.job_name as string) ?? "",
    generatorEpaId: (row.generator_epa_id as string) ?? "",
    generatorName: (row.generator_name as string) ?? "",
    generatorAddress: (row.generator_address as string) ?? "",
    status: row.status as LabPackJob["status"],
    epaMtn: (row.epa_mtn as string | null) ?? null,
    drumCount: Number(row.drum_count ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

/** Marks a lab pack drum as loaded onto a specific manifest line -- same
 * write linkLabPackToManifestLine does, scoped through the claimed token. */
export async function linkLabPackToManifestLineForWasteLineToken(
  supabase: SupabaseClient,
  tokenId: string,
  labPackId: string,
  lineNumber: number
): Promise<void> {
  const { error } = await supabase.rpc("link_lab_pack_to_manifest_line_for_waste_line_token", {
    p_token_id: tokenId,
    p_lab_pack_id: labPackId,
    p_line_number: lineNumber,
  });
  if (error) console.error("linkLabPackToManifestLineForWasteLineToken failed (non-fatal):", error.message);
}

/** Same upsert upsertWasteLineMetadata does, scoped through the claimed token. */
export async function upsertWasteLineMetadataForWasteLineToken(
  supabase: SupabaseClient,
  tokenId: string,
  lines: { lineNumber: number; wastewaterCategory: string; isLabPack: boolean; labPackId: string | null }[]
): Promise<void> {
  if (lines.length === 0) return;
  const { error } = await supabase.rpc("upsert_waste_line_metadata_for_waste_line_token", {
    p_token_id: tokenId,
    p_lines: lines.map((l) => ({
      line_number: l.lineNumber,
      wastewater_category: l.wastewaterCategory,
      is_lab_pack: l.isLabPack,
      lab_pack_id: l.labPackId,
    })),
  });
  if (error) console.error("upsertWasteLineMetadataForWasteLineToken failed (non-fatal):", error.message);
}

/** Un-claims a token after a successful "peek" (Unlock step) WITHOUT
 * incrementing failed_attempt_count -- see the migration's comment for why
 * reusing releaseWasteLineEditToken here would be wrong. */
export async function releaseWasteLineEditTokenAfterPeek(supabase: SupabaseClient, tokenId: string): Promise<void> {
  const { error } = await supabase.rpc("release_waste_line_edit_token_after_peek", { p_token_id: tokenId });
  if (error) console.error("releaseWasteLineEditTokenAfterPeek failed:", error.message);
}

export interface MirroredManifestSummary {
  generatorName: string | null;
  designatedFacilityName: string | null;
  designatedFacilityEpaSiteId: string | null;
}

/** The manifest's designated-facility EPA ID from the local mirror
 * (recordManifestLocally), not a live RCRAInfo call -- see
 * 2026092207_get_mirrored_manifest_for_waste_line_token.sql's comment for
 * why this is safe (a manifest's designated facility never changes after
 * creation). Returns null if the manifest was never locally mirrored
 * (shouldn't happen for anything created through this app). */
export async function getMirroredManifestForWasteLineToken(
  supabase: SupabaseClient,
  tokenId: string
): Promise<MirroredManifestSummary | null> {
  const { data, error } = await supabase.rpc("get_mirrored_manifest_for_waste_line_token", { p_token_id: tokenId });
  if (error) {
    console.error("getMirroredManifestForWasteLineToken failed:", error.message);
    return null;
  }
  const row = data?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    generatorName: (row.generator_name as string | null) ?? null,
    designatedFacilityName: (row.designated_facility_name as string | null) ?? null,
    designatedFacilityEpaSiteId: (row.designated_facility_epa_site_id as string | null) ?? null,
  };
}
