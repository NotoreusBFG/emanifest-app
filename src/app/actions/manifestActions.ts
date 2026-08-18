"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getRcrainfoClientForUser, getRcrainfoClientForAction } from "@/services/manifestService";
import {
  recordManifestLocally,
  fetchAndStoreManifestDocuments,
  listDocumentsForManifest,
  getDocumentDownloadUrl,
  recordSignatureConsent,
  listRecentManifestsForUser,
  type RecentManifestSearch,
} from "@/services/manifestRepository";
import {
  getWasteLineMetadataForManifest,
  upsertWasteLineMetadata,
  type WasteLineMetadata,
} from "@/services/wasteLineMetadataRepository";
import { certificationTextFor } from "@/lib/rcrainfo/certificationText";
import { collectManifestOperationWarnings } from "@/lib/rcrainfo/types";
import { formatRcrainfoError } from "@/lib/rcrainfo/formatError";
import { buildNewManifestInputFromFormData } from "@/lib/rcrainfo/buildManifestInput";
import type {
  FederalWasteCode,
  Manifest,
  QuickerSignParameters,
  SiteSearchParams,
  SiteSearchResultItem,
} from "@/lib/rcrainfo/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ManifestFetchResult =
  | { success: true; manifest: Manifest }
  | { success: false; error: string };

export type LookupManifestState = ManifestFetchResult | null;

/** Shared by the lookup form action and the post-sign refresh call below.
 * Delegation-aware (no siteType — lookup isn't role-specific): a Quick-Sign
 * delegate with no EPA credentials of their own can still look up whatever
 * their delegation owner can see, which is what lets them find a manifest
 * to sign in the first place. */
async function fetchManifestForCurrentUser(
  supabase: SupabaseClient,
  userId: string,
  mtn: string
): Promise<ManifestFetchResult> {
  try {
    const { client, effectiveUserId } = await getRcrainfoClientForAction(supabase, userId);
    const manifest = await client.getManifest(mtn);

    // Piggybacks on every fetch (initial lookup, post-sign refresh, the
    // Save & Sign flow's refetch) to keep the local mirror table
    // reasonably fresh, rather than adding separate sync calls at each
    // call site. This is real EPA-confirmed data (status included), unlike
    // the initial record written straight after save, which only knows
    // the submitted "NotAssigned" status until a fetch like this corrects it.
    // Recorded under effectiveUserId (the delegation owner, when acting as
    // a delegate) so this stays consistent with where a delegated sign's
    // data lands — one account, one picture, regardless of who looked or
    // signed.
    await recordManifestLocally(supabase, effectiveUserId, manifest);

    return { success: true, manifest };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}

/** Last 10 manifests this user has looked up, created, or signed through
 * ManifestMate, most recent first — feeds the lookup page's "Recent
 * searches" list. */
export async function listRecentManifestSearchesAction(): Promise<RecentManifestSearch[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listRecentManifestsForUser(supabase, user.id, 10);
}

export async function lookupManifestAction(
  prevState: LookupManifestState,
  formData: FormData
): Promise<LookupManifestState> {
  const mtn = (formData.get("mtn") as string)?.trim();
  if (!mtn) return { success: false, error: "Enter a manifest tracking number." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  return fetchManifestForCurrentUser(supabase, user.id, mtn);
}

/**
 * Called directly (not via <form action>) after a successful sign, to
 * refresh the displayed manifest's status/handlers without making the user
 * re-submit the lookup form.
 */
export async function refetchManifestAction(mtn: string): Promise<ManifestFetchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  return fetchManifestForCurrentUser(supabase, user.id, mtn);
}

export type SignManifestState =
  | { success: true; message: string }
  | { success: false; error: string };

export interface SignManifestParams {
  manifestTrackingNumber: string;
  siteId: string;
  siteType: "Generator" | "Transporter" | "Tsdf";
  transporterOrder?: number;
  printedSignatureName: string;
}

/**
 * Wraps RcrainfoClient.signManifest() (quicker-sign) — confirmed live in
 * earlier sessions via test scripts (full Generator -> Transporter -> Tsdf
 * chain on 100091730ELC), but this is its first exposure in the actual app
 * UI rather than a standalone script.
 */
export async function signManifestAction(params: SignManifestParams): Promise<SignManifestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  // The "signing your life away" audit trail — recorded regardless of
  // whether the sign attempt actually succeeds, since a failed attempt is
  // still evidence of what this user tried to do and agreed to. The
  // certification text is recomputed here from `params.siteType`, not
  // trusted as a value from the client — the whole point of this record is
  // proof of what was actually shown, so it has to come from the same
  // source of truth the UI itself renders from (certificationText.ts).
  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? null;
  const userAgent = headersList.get("user-agent");
  const certification = certificationTextFor(params.siteType);

  // Resolved inside the try block below (it can itself throw — e.g. a
  // delegate whose access doesn't cover this role), but declared here so
  // the catch block's recordConsent call can still attribute the attempt
  // correctly if resolution succeeded but a later step failed.
  let effectiveUserId = user.id;
  let signedForOwnerUserId: string | null = null;

  const recordConsent = (
    outcome: { signSucceeded: boolean; epaReportId?: string; epaError?: string },
    manifestId: string | null
  ) =>
    recordSignatureConsent(supabase, {
      userId: user.id,
      manifestId,
      epaMtn: params.manifestTrackingNumber,
      siteType: params.siteType,
      transporterOrder: params.transporterOrder,
      siteId: params.siteId,
      printedSignatureName: params.printedSignatureName,
      certificationHeading: certification.heading,
      certificationText: certification.paragraphs.join("\n\n"),
      certificationIsVerbatim: certification.isVerbatim,
      ipAddress,
      userAgent,
      signedForOwnerUserId,
      ...outcome,
    });

  const signParams: QuickerSignParameters = {
    siteId: params.siteId,
    siteType: params.siteType,
    printedSignatureName: params.printedSignatureName,
    printedSignatureDate: new Date().toISOString(),
    manifestTrackingNumbers: [params.manifestTrackingNumber],
    transporterOrder: params.transporterOrder,
  };

  try {
    // Delegation-aware: falls back to a Quick-Sign delegation owner's
    // credentials if the caller has none of their own (see
    // docs/delegate-quick-sign-design.md). effectiveUserId is whose
    // account the resulting manifest/document records belong to — the
    // owner's, when this is a delegated sign — so recordConsent above
    // (which always uses the real caller, user.id) stays the only place
    // that records who actually triggered this.
    const signer = await getRcrainfoClientForAction(supabase, user.id, params.siteType);
    const client = signer.client;
    effectiveUserId = signer.effectiveUserId;
    signedForOwnerUserId = signer.delegation?.ownerUserId ?? null;

    const result = await client.signManifest(signParams);

    // A non-2xx HTTP response throws (caught below), but an individual MTN
    // can still fail within an otherwise-"successful" response — surface
    // that the same way rather than reporting false success.
    const report = result.manifestReports[0];
    if (report?.manifestError) {
      await recordConsent({ signSucceeded: false, epaError: report.manifestError.message }, null);
      return { success: false, error: report.manifestError.message };
    }

    // Best-effort: capture whatever documents RCRAInfo has right after this
    // signature (confirmed live in earlier testing that documents become
    // available progressively, not only once every party has signed).
    // Needs the full manifest (for recordManifestLocally's denormalized
    // fields), so this is a second live call beyond the sign itself, but
    // signing is a deliberate, infrequent user action, not a hot path.
    let localId: string | null = null;
    try {
      const freshManifest = await client.getManifest(params.manifestTrackingNumber);
      localId = await recordManifestLocally(supabase, effectiveUserId, freshManifest, {
        siteType: params.siteType,
        transporterOrder: params.transporterOrder,
        signedAt: new Date().toISOString(),
      });
      if (localId) {
        await fetchAndStoreManifestDocuments(
          supabase,
          client,
          effectiveUserId,
          localId,
          params.manifestTrackingNumber
        );
      }
    } catch (syncErr) {
      console.error("Post-sign document sync failed (non-fatal):", syncErr);
    }

    await recordConsent({ signSucceeded: true, epaReportId: result.reportId }, localId);

    return {
      success: true,
      message: report?.manifestSigned?.message ?? `Signed as ${params.siteType}.`,
    };
  } catch (err) {
    const errorMessage = formatRcrainfoError(err);
    await recordConsent({ signSucceeded: false, epaError: errorMessage }, null);
    return { success: false, error: errorMessage };
  }
}

export type SiteDetailsState =
  | { success: true; site: SiteSearchResultItem }
  | { success: false; error: string };

/**
 * Looks up a single site by its exact EPA ID — used to prefill the
 * generator fields from the EPA ID number captured during onboarding
 * (docs/epa-registration-wizard-design.md), where the user knows their
 * exact ID rather than searching by name. Wraps `getSiteDetails()`;
 * `SiteSearchResultItem` and `SiteDetails` are the same type (see
 * types.ts), so the result feeds straight into the form's existing
 * `fillHandlerFromSite` helper.
 */
export async function getSiteDetailsAction(epaSiteId: string): Promise<SiteDetailsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const site = await client.getSiteDetails(epaSiteId);
    return { success: true, site };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}

/**
 * Wastewater/nonwastewater category and lab-pack flag captured per waste
 * line at manifest creation time (see wasteLineMetadataRepository.ts) --
 * used by the LDR notice's `?mtn=` prefill so it doesn't have to guess.
 * Returns an empty map (not an error) for a manifest created before this
 * existed, or if nothing was captured -- callers should fall back to
 * sensible defaults.
 */
export async function getWasteLineMetadataAction(
  epaMtn: string
): Promise<Record<number, WasteLineMetadata>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  return getWasteLineMetadataForManifest(supabase, user.id, epaMtn);
}

export type SiteSearchState =
  | { success: true; sites: SiteSearchResultItem[] }
  | { success: false; error: string };

/**
 * Called directly from the manifest form's site-search autocomplete (not a
 * <form action> — Server Actions can be invoked as plain async functions
 * from client components). Wraps `RcrainfoClient.searchSites()` — confirmed
 * live 2026-07-24, see `SiteSearchParams`/`SiteSearchResultItem` in
 * `types.ts` for the Content-Type quirk this endpoint needed.
 */
export async function searchSitesAction(params: SiteSearchParams): Promise<SiteSearchState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const result = await client.searchSites(params);
    return { success: true, sites: result.sites ?? [] };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}

export type FederalWasteCodeState =
  | { success: true; codes: FederalWasteCode[] }
  | { success: false; error: string };

/** In-process cache — this is static regulatory reference data (567 codes,
 * confirmed live 2026-07-25) that changes rarely, so there's no reason to
 * hit RCRAInfo's API on every manifest form load. Cleared on server
 * restart; not persisted anywhere more durable since staleness risk here
 * is low and the cost of being wrong is just a missing/renamed code
 * showing up a bit late. */
let cachedFederalWasteCodes: FederalWasteCode[] | null = null;

/**
 * Called directly from the waste-line federal-waste-code picker. Backs
 * `RcrainfoClient.getFederalWasteCodes()` — used to constrain that field to
 * real EPA codes instead of free text a user could mistype (same class of
 * bug as the literal "None" hit earlier in the DOT ID number field).
 */
export async function getFederalWasteCodesAction(): Promise<FederalWasteCodeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  if (cachedFederalWasteCodes) {
    return { success: true, codes: cachedFederalWasteCodes };
  }

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const codes = await client.getFederalWasteCodes();
    cachedFederalWasteCodes = codes;
    return { success: true, codes };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}

export type CreateManifestState =
  | { success: true; manifestTrackingNumber: string; warnings: string[]; intent: "draft" | "sign" }
  | { success: false; error: string }
  | null;

export async function createManifestAction(
  prevState: CreateManifestState,
  formData: FormData
): Promise<CreateManifestState> {
  // Which of the two submit buttons was used — see the "Save as draft" /
  // "Save & sign" buttons in the form. Only the activated submit button's
  // name/value pair is included in FormData, per the HTML spec, so this
  // works without any extra client-side wiring.
  const intent = formData.get("intent") === "sign" ? "sign" : "draft";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const built = buildNewManifestInputFromFormData(formData);
  if (built.error) {
    return { success: false, error: built.error };
  }
  const { input, wasteLineMetadata } = built;

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const result = await client.saveManifest(input);

    await recordManifestLocally(supabase, user.id, {
      manifestTrackingNumber: result.manifestTrackingNumber,
      status: input.status,
      generator: input.generator,
      transporters: input.transporters,
      designatedFacility: input.designatedFacility,
    });
    await upsertWasteLineMetadata(supabase, user.id, result.manifestTrackingNumber, wasteLineMetadata);

    return {
      success: true,
      manifestTrackingNumber: result.manifestTrackingNumber,
      warnings: collectManifestOperationWarnings(result),
      intent,
    };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}

export interface StoredDocument {
  filename: string;
  url: string;
}

/**
 * Documents only exist locally once fetchAndStoreManifestDocuments() has
 * run at least once (currently: after a successful sign) — returns an
 * empty array otherwise, same "nothing here yet" semantics as an empty
 * dashboard rather than an error.
 */
export async function listStoredDocumentsAction(mtn: string): Promise<StoredDocument[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // No explicit user_id filter — RLS already restricts this to rows the
  // caller owns or is an active Quick-Sign delegate for (see
  // 2026072801_add_delegate_read_access.sql), so a delegate can see documents
  // recorded under their delegation owner's account too.
  const { data: manifestRow } = await supabase
    .from("manifests")
    .select("id")
    .eq("epa_mtn", mtn)
    .maybeSingle();
  if (!manifestRow) return [];

  const docs = await listDocumentsForManifest(supabase, manifestRow.id);
  const withUrls = await Promise.all(
    docs.map(async (doc) => ({
      filename: doc.filename,
      url: await getDocumentDownloadUrl(supabase, doc.storage_path),
    }))
  );

  return withUrls.filter((doc): doc is StoredDocument => doc.url !== null);
}
