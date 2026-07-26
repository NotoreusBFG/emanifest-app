import JSZip from "jszip";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { getHandlerSignatureStatus, type Manifest } from "@/lib/rcrainfo/types";
import type { RcrainfoClient } from "@/lib/rcrainfo/client";

/**
 * Next.js forwards server-side `console.error` calls to the browser's dev
 * overlay, but a raw PostgrestError object loses its content in that
 * serialization and shows up as a blank `{}` — logging the actual fields
 * as a plain string instead so the real error (e.g. a missing column) is
 * visible without needing terminal access to the dev server.
 */
export function describePostgrestError(error: PostgrestError): string {
  return `[${error.code}] ${error.message}${error.details ? ` — ${error.details}` : ""}${error.hint ? ` (hint: ${error.hint})` : ""}`;
}

export interface LocalManifestRecord {
  id: string;
  epa_mtn: string;
  epa_status: string | null;
  generator_name: string | null;
  generator_epa_site_id: string | null;
  transporter_names: string | null;
  designated_facility_name: string | null;
  designated_facility_epa_site_id: string | null;
  generator_signed_at: string | null;
  transporter_signed_at: string | null;
  facility_signed_at: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string;
}

/**
 * `transporter_signed_at` represents ALL transporters having signed (the
 * latest of their signature dates), not just the first — the "transport
 * leg is complete" checkmark, meaningful even once multi-transporter
 * manifests are supported. Empty transporters array (shouldn't happen on
 * a real manifest, but the type allows it) counts as not signed rather
 * than vacuously signed.
 */
function latestTransporterSignedAt(transporters: Manifest["transporters"]): string | null {
  if (!transporters || transporters.length === 0) return null;
  const statuses = transporters.map(getHandlerSignatureStatus);
  if (!statuses.every((s) => s.signed)) return null;
  return statuses.reduce<string | null>((latest, s) => {
    if (!s.signatureDate) return latest;
    return !latest || s.signatureDate > latest ? s.signatureDate : latest;
  }, null);
}

/**
 * Upserts a local mirror row for a manifest that's already been saved to
 * EPA (see `manifests` table comment in the migration for why this isn't a
 * true pre-EPA draft store yet). Called after both `createManifestAction`
 * saves and `signManifestAction` signs, so the local record's `epa_status`
 * stays reasonably fresh without needing a separate sync job.
 *
 * Deliberately swallows errors rather than throwing — EPA already has the
 * authoritative record by the time this runs; a failed local mirror write
 * shouldn't turn a real, successful save/sign into a user-facing failure.
 * Logs to the server console so a broken mirror doesn't fail silently
 * forever, just not in the user's face.
 */
export interface JustSigned {
  siteType: "Generator" | "Transporter" | "Tsdf";
  transporterOrder?: number;
  signedAt: string;
}

/** Returns the local row's id on success, or null (logged, non-fatal) on failure. */
export async function recordManifestLocally(
  supabase: SupabaseClient,
  userId: string,
  manifest: Pick<Manifest, "manifestTrackingNumber" | "status" | "generator" | "transporters" | "designatedFacility">,
  // Set by signManifestAction right after a signature succeeds -- EPA's own
  // API can lag between a sign succeeding and a subsequent GET reflecting
  // it (confirmed live: a dashboard row didn't show a just-completed
  // Generator signature until a later, separate lookup re-synced it), so
  // when we already KNOW a specific role just signed, that's trusted over
  // what an immediate re-fetch says, rather than risk overwriting a real
  // signature with a stale "not signed" read.
  justSigned?: JustSigned
): Promise<string | null> {
  const generatorStatus = getHandlerSignatureStatus(manifest.generator);
  const facilityStatus = getHandlerSignatureStatus(manifest.designatedFacility);

  const generatorSignedAt = generatorStatus.signed
    ? generatorStatus.signatureDate ?? null
    : justSigned?.siteType === "Generator"
      ? justSigned.signedAt
      : null;

  const facilitySignedAt = facilityStatus.signed
    ? facilityStatus.signatureDate ?? null
    : justSigned?.siteType === "Tsdf"
      ? justSigned.signedAt
      : null;

  let transporterSignedAt = latestTransporterSignedAt(manifest.transporters);
  // Only safe to trust the override when there's exactly one transporter —
  // transporter_signed_at means ALL transporters have signed, which can't
  // be inferred from a single just-signed role on a multi-transporter
  // manifest without knowing the others' true state too.
  if (
    !transporterSignedAt &&
    justSigned?.siteType === "Transporter" &&
    (manifest.transporters?.length ?? 0) === 1
  ) {
    transporterSignedAt = justSigned.signedAt;
  }

  const { data, error } = await supabase
    .from("manifests")
    .upsert(
      {
        user_id: userId,
        epa_mtn: manifest.manifestTrackingNumber,
        epa_status: manifest.status,
        generator_name: manifest.generator?.name ?? null,
        generator_epa_site_id: manifest.generator?.epaSiteId ?? null,
        transporter_names:
          manifest.transporters
            ?.map((t) => t.name)
            .filter(Boolean)
            .join(", ") || null,
        designated_facility_name: manifest.designatedFacility?.name ?? null,
        designated_facility_epa_site_id: manifest.designatedFacility?.epaSiteId ?? null,
        generator_signed_at: generatorSignedAt,
        transporter_signed_at: transporterSignedAt,
        facility_signed_at: facilitySignedAt,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "epa_mtn" }
    )
    .select("id")
    .single();

  if (error) {
    console.error("recordManifestLocally failed (non-fatal):", describePostgrestError(error));
    return null;
  }
  return data.id;
}

export async function listManifestsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<LocalManifestRecord[]> {
  const { data, error } = await supabase
    .from("manifests")
    .select(
      "id, epa_mtn, epa_status, generator_name, generator_epa_site_id, transporter_names, designated_facility_name, designated_facility_epa_site_id, generator_signed_at, transporter_signed_at, facility_signed_at, created_at, updated_at, last_synced_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listManifestsForUser failed:", describePostgrestError(error));
    return [];
  }
  return data;
}

export interface ManifestDocumentRecord {
  id: string;
  filename: string;
  storage_path: string;
  file_size_bytes: number | null;
  fetched_at: string;
}

/**
 * Fetches RCRAInfo's document zip (GET .../attachments — confirmed live to
 * return 2 PDFs + one HTML per signer) and stores each file in Supabase
 * Storage plus a `manifest_documents` row, so documents can be viewed/
 * printed later without re-fetching from EPA every time. Same
 * best-effort/non-fatal error handling as `recordManifestLocally` — called
 * after a real, already-successful sign, so a storage failure shouldn't
 * turn that into a user-facing error.
 *
 * `upsert: true` on both the Storage write and the DB row means calling
 * this again for the same manifest (e.g. after a later signature adds a
 * new HTML cert) safely overwrites rather than duplicating.
 */
export async function fetchAndStoreManifestDocuments(
  supabase: SupabaseClient,
  rcrainfoClient: RcrainfoClient,
  userId: string,
  manifestId: string,
  mtn: string
): Promise<void> {
  try {
    const parts = await rcrainfoClient.getManifestAttachments(mtn);
    const zipPart = parts.find((p) => p.contentType === "application/octet-stream");
    if (!zipPart || !Buffer.isBuffer(zipPart.data)) {
      console.error(`fetchAndStoreManifestDocuments: no document zip in attachments response for ${mtn}`);
      return;
    }

    const zip = await JSZip.loadAsync(zipPart.data);

    for (const [filename, file] of Object.entries(zip.files)) {
      if (file.dir) continue;

      const bytes = await file.async("uint8array");
      const storagePath = `${userId}/${manifestId}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("manifest-documents")
        .upload(storagePath, bytes, {
          contentType: filename.endsWith(".pdf") ? "application/pdf" : "text/html",
          upsert: true,
        });

      if (uploadError) {
        console.error(`fetchAndStoreManifestDocuments: upload failed for ${filename}:`, uploadError.message);
        continue;
      }

      const { error: dbError } = await supabase.from("manifest_documents").upsert(
        {
          manifest_id: manifestId,
          filename,
          storage_path: storagePath,
          file_size_bytes: bytes.length,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "manifest_id,filename" }
      );

      if (dbError) {
        console.error(
          `fetchAndStoreManifestDocuments: db record failed for ${filename}:`,
          describePostgrestError(dbError)
        );
      }
    }
  } catch (err) {
    console.error(
      `fetchAndStoreManifestDocuments failed for ${mtn} (non-fatal):`,
      err instanceof Error ? err.message : err
    );
  }
}

export async function listDocumentsForManifest(
  supabase: SupabaseClient,
  manifestId: string
): Promise<ManifestDocumentRecord[]> {
  const { data, error } = await supabase
    .from("manifest_documents")
    .select("id, filename, storage_path, file_size_bytes, fetched_at")
    .eq("manifest_id", manifestId)
    .order("filename");

  if (error) {
    console.error("listDocumentsForManifest failed:", describePostgrestError(error));
    return [];
  }
  return data;
}

/** Short-lived signed URL — the bucket is private, so documents aren't reachable without one. */
export async function getDocumentDownloadUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage.from("manifest-documents").createSignedUrl(storagePath, 600);

  if (error) {
    console.error("getDocumentDownloadUrl failed:", error.message);
    return null;
  }
  return data.signedUrl;
}

export interface SignatureConsentRecord {
  userId: string;
  manifestId: string | null;
  epaMtn: string;
  siteType: string;
  transporterOrder?: number;
  siteId: string;
  printedSignatureName: string;
  certificationHeading: string;
  certificationText: string;
  certificationIsVerbatim: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  signSucceeded: boolean;
  epaReportId?: string;
  epaError?: string;
  /** Set when this sign happened through a Quick-Sign delegation — the
   * account whose credentials were actually used, distinct from userId
   * (the real person who triggered it). Null for ordinary, non-delegated
   * signs. */
  signedForOwnerUserId?: string | null;
}

/**
 * Records the "signing your life away" clickwrap audit trail — see the
 * migration's comment for why this exists alongside, not instead of,
 * EPA's own CROMERR signature record. Called from signManifestAction after
 * every confirmed sign attempt, success or failure, so the record captures
 * what was actually shown and what actually happened either way.
 *
 * Deliberately does NOT swallow-and-continue silently the way
 * recordManifestLocally does for a failed write — logs loudly (still
 * doesn't throw, so a DB hiccup can't turn a real EPA signature into a
 * user-facing error) since losing an audit record is a bigger problem than
 * losing a denormalized display cache.
 */
export async function recordSignatureConsent(
  supabase: SupabaseClient,
  consent: SignatureConsentRecord
): Promise<void> {
  const { error } = await supabase.from("signature_consents").insert({
    user_id: consent.userId,
    manifest_id: consent.manifestId,
    epa_mtn: consent.epaMtn,
    site_type: consent.siteType,
    transporter_order: consent.transporterOrder ?? null,
    site_id: consent.siteId,
    printed_signature_name: consent.printedSignatureName,
    certification_heading: consent.certificationHeading,
    certification_text: consent.certificationText,
    certification_is_verbatim: consent.certificationIsVerbatim,
    ip_address: consent.ipAddress,
    user_agent: consent.userAgent,
    sign_succeeded: consent.signSucceeded,
    epa_report_id: consent.epaReportId ?? null,
    epa_error: consent.epaError ?? null,
    signed_for_owner_user_id: consent.signedForOwnerUserId ?? null,
  });

  if (error) {
    console.error("recordSignatureConsent FAILED — audit trail gap:", describePostgrestError(error));
  }
}
