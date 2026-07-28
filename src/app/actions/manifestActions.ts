"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getRcrainfoClientForUser,
  getRcrainfoClientForAction,
  NoCredentialsError,
} from "@/services/manifestService";
import {
  recordManifestLocally,
  fetchAndStoreManifestDocuments,
  listDocumentsForManifest,
  getDocumentDownloadUrl,
  recordSignatureConsent,
} from "@/services/manifestRepository";
import {
  getWasteLineMetadataForManifest,
  upsertWasteLineMetadata,
  type WasteLineMetadata,
} from "@/services/wasteLineMetadataRepository";
import { certificationTextFor, AGENCY_AUTHORITY_ITEM_14_TEXT } from "@/lib/rcrainfo/certificationText";
import { RcrainfoApiError, collectManifestOperationWarnings } from "@/lib/rcrainfo/types";
import type {
  FederalWasteCode,
  Manifest,
  NewManifestInput,
  QuickerSignParameters,
  SiteSearchParams,
  SiteSearchResultItem,
  WasteLine,
} from "@/lib/rcrainfo/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// A handful of RCRAInfo error messages are common enough (and confusing
// enough raw) to warrant a friendlier rewrite. Anything not matched here
// falls through to the raw JSON — deliberately not guessing at a friendly
// message for shapes we haven't actually seen and confirmed live.
function friendlyRcrainfoMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("message" in body)) return null;
  const message = (body as { message?: unknown }).message;
  if (typeof message !== "string") return null;

  if (message.includes("Site Services Permission")) {
    return "You don't have signing permission for this site. Check with your RCRAInfo account admin to confirm you've been granted Site Services Permission for it.";
  }

  return null;
}

function formatRcrainfoError(err: unknown): string {
  if (err instanceof NoCredentialsError) return err.message;
  if (err instanceof RcrainfoApiError) {
    // Save/update validation error bodies have an inconsistent shape
    // (sometimes a flat {message,field,value}, sometimes a nested report) —
    // shown raw rather than guessing a structure that might be wrong.
    return (
      friendlyRcrainfoMessage(err.body) ?? `RCRAInfo error (${err.status}): ${JSON.stringify(err.body)}`
    );
  }
  return err instanceof Error ? err.message : "Unknown error.";
}

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

  const f = (name: string) => (formData.get(name) as string)?.trim() ?? "";

  const input: NewManifestInput = {
    status: "NotAssigned",
    submissionType: "FullElectronic",
    originType: "Web",
    import: false,
    export: false,
    generator: {
      epaSiteId: f("generatorEpaSiteId"),
      name: f("generatorName"),
      mailingAddress: {
        address1: f("generatorAddress1"),
        city: f("generatorCity"),
        state: { code: f("generatorState") },
        country: { code: "US" },
        zip: f("generatorZip"),
      },
      siteAddress: {
        address1: f("generatorAddress1"),
        city: f("generatorCity"),
        state: { code: f("generatorState") },
        country: { code: "US" },
        zip: f("generatorZip"),
      },
      contact: {
        firstName: f("generatorFirstName"),
        lastName: f("generatorLastName"),
        phone: { number: f("generatorPhone") },
        email: f("generatorEmail"),
      },
      emergencyPhone: { number: f("generatorEmergencyPhone") },
    },
    // Filled in below, after validation -- matches the wasteLineIds pattern.
    transporters: [],
    designatedFacility: {
      epaSiteId: f("facilityEpaSiteId"),
      name: f("facilityName"),
      mailingAddress: {
        address1: f("facilityAddress1"),
        city: f("facilityCity"),
        state: { code: f("facilityState") },
        country: { code: "US" },
        zip: f("facilityZip"),
      },
      siteAddress: {
        address1: f("facilityAddress1"),
        city: f("facilityCity"),
        state: { code: f("facilityState") },
        country: { code: "US" },
        zip: f("facilityZip"),
      },
      contact: {
        firstName: f("facilityFirstName"),
        lastName: f("facilityLastName"),
        phone: { number: f("facilityPhone") },
        email: f("facilityEmail"),
      },
      emergencyPhone: { number: f("facilityEmergencyPhone") },
    },
    additionalInfo: undefined, // filled in below, after collecting per-line instructions
    wastes: [], // filled in below, after validation
  };

  // Waste lines are a flat array however many there are — RCRAInfo has no
  // "page"/"continuation" concept at all and auto-paginates the generated
  // PDF itself (confirmed live: 4 lines/1 page, 6 lines/2 pages, 15
  // lines/3 pages, all without us doing anything page-related). Slots with
  // no description entered are treated as unused and dropped, so the form
  // can show 4+ empty slots without forcing every one to be filled — but a
  // line that IS used must have quantity/unit/container filled in, or
  // RCRAInfo hard-rejects it with an empty-string schema error. Validated
  // here, before calling the API, so the user gets a specific "line 3 is
  // missing X" message instead of a raw API error dump.
  // Every transporter row the user added is required (unlike waste lines,
  // there's no "blank optional slot" concept here — each one is explicitly
  // added via "+ Add another transporter"). `order` is the array position,
  // matching EPA's own "Transporter 1"/"Transporter 2"/... numbering
  // (Items 6/7 on the main form, Items 25/26 on continuation sheets).
  const transporterIds = (formData.get("transporterIds") as string).split(",").filter(Boolean);
  input.transporters = transporterIds.map((id, index) => ({
    epaSiteId: (formData.get(`transporterEpaSiteId_${id}`) as string)?.trim() ?? "",
    name: (formData.get(`transporterName_${id}`) as string)?.trim() ?? "",
    order: index + 1,
  }));

  const wasteLineIds = (formData.get("wasteLineIds") as string).split(",").filter(Boolean);
  const wastes: WasteLine[] = [];
  const lineErrors: string[] = [];
  const lineInstructionNotes: string[] = [];
  // Wastewater/nonwastewater per line -- a ManifestMate-only concept
  // (RCRAInfo's schema has no field for it), captured here so it's known
  // and accurate later if an LDR notice gets filed for this manifest,
  // instead of guessing. Keyed by the same displayLineNumber sent to EPA,
  // so it matches back up against manifest.wastes[].lineNumber on a
  // subsequent GET.
  const wasteLineMetadata: { lineNumber: number; wastewaterCategory: "wastewater" | "nonwastewater"; isLabPack: boolean }[] = [];

  for (const id of wasteLineIds) {
    const w = (name: string) => (formData.get(`${name}_${id}`) as string)?.trim() ?? "";
    const isHazardous = formData.get(`dotHazardous_${id}`) === "on";
    const properShippingName = w("properShippingName");
    const wasteDescription = w("wasteDescription");
    const description = isHazardous ? properShippingName : wasteDescription;
    if (!description) continue; // unused slot

    const displayLineNumber = wastes.length + 1;
    const specialInstructions = w("specialInstructions");
    if (specialInstructions) {
      lineInstructionNotes.push(`Line ${displayLineNumber}: ${specialInstructions}`);
    }

    const quantity = Number(w("quantity"));
    const unitCode = w("unitCode");
    const containerNumber = Number(w("containerNumber"));
    const containerTypeCode = w("containerTypeCode");
    if (!quantity || !unitCode || !containerNumber || !containerTypeCode) {
      lineErrors.push(
        `Waste line ${displayLineNumber}: quantity, unit code, container count, and container type code are all required once a description is entered.`
      );
      continue;
    }

    const quantityField = {
      quantity,
      unitOfMeasurement: { code: unitCode },
      containerNumber,
      containerType: { code: containerTypeCode },
    };

    // Multiple codes are common on a real waste line (e.g. "D001, D003") —
    // split on commas rather than only supporting one, which RCRAInfo
    // rejects outright as an invalid single code format.
    const federalWasteCodes = w("federalWasteCode")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((code) => ({ code }));

    if (federalWasteCodes.length > 0) {
      const wastewaterCategory = formData.get(`wastewaterCategory_${id}`) === "wastewater" ? "wastewater" : "nonwastewater";
      const isLabPack = formData.get(`labPack_${id}`) === "on";
      wasteLineMetadata.push({ lineNumber: displayLineNumber, wastewaterCategory, isLabPack });
    }

    if (isHazardous) {
      const idNumberCode = w("idNumberCode");
      const rq = formData.get(`rqIndicator_${id}`) === "on";
      // A material can be DOT-hazardous without being a RCRA hazardous
      // waste (e.g. solid vs. liquid sodium hydroxide — only the liquid
      // exhibits the D002 corrosivity characteristic). "Waste" is a
      // conventional prefix on the shipping description, not something
      // baked into any §172.101 table entry (confirmed: zero entries in
      // the parsed table start with "Waste").
      const isRcraWaste = formData.get(`isRcraWaste_${id}`) === "on";
      const shippingName = isRcraWaste ? `Waste ${properShippingName}` : properShippingName;
      // ID number listed first per request — DOT (49 CFR 172.202(b))
      // permits the ID number either immediately before or after the
      // shipping description; this composes it in that order rather
      // than relying on the user to type the whole string correctly.
      const printedDotInformation = [
        idNumberCode || null,
        rq ? "RQ" : null,
        shippingName,
        w("hazardClass") || null,
        w("packingGroup") ? `PG ${w("packingGroup")}` : null,
      ]
        .filter(Boolean)
        .join(", ");

      wastes.push({
        lineNumber: displayLineNumber,
        dotHazardous: true,
        wasteDescription: properShippingName, // ignored by RCRAInfo for hazardous lines, but still a required field
        quantity: quantityField,
        dotInformation: { printedDotInformation, idNumber: { code: idNumberCode } },
        hazardousWaste: federalWasteCodes.length ? { federalWasteCodes } : undefined,
        br: false,
        pcb: false,
        // Distinct from dotHazardous — this is EPA's "is this actually a
        // regulated hazardous waste" flag, not DOT's hazmat flag. Tied to
        // the RCRA waste checkbox rather than hardcoded true, since the
        // two can legitimately disagree (see isRcraWaste comment above).
        epaWaste: isRcraWaste,
      });
    } else {
      wastes.push({
        lineNumber: displayLineNumber,
        dotHazardous: false,
        wasteDescription,
        quantity: quantityField,
        br: false,
        pcb: false,
        epaWaste: false, // CONFIRMED: RCRAInfo rejects true here when dotHazardous is false
      });
    }
  }

  if (lineErrors.length > 0) {
    return { success: false, error: lineErrors.join(" ") };
  }
  if (wastes.length === 0) {
    return { success: false, error: "Add at least one waste line with a description." };
  }
  input.wastes = wastes;

  // 40 CFR 263.21(b)(3): if the generator's contract with the initial
  // transporter grants that transporter agency authority to add/substitute
  // additional transporters on the generator's behalf, that has to be
  // declared in Item 14 via this exact sentence. Captured here (creation
  // time) rather than at signing — it's the generator's own contractual
  // assertion, and Item 14 is only ever reliably editable before anyone has
  // signed (see the "transporter locked once InTransit" finding this
  // otherwise ran into).
  const agencyAuthorityGranted = formData.get("agencyAuthorityGranted") === "on";

  const combinedHandlingInstructions = [
    f("handlingInstructions"),
    agencyAuthorityGranted ? AGENCY_AUTHORITY_ITEM_14_TEXT : "",
    ...lineInstructionNotes,
  ]
    .filter(Boolean)
    .join(" | ");
  input.additionalInfo = combinedHandlingInstructions
    ? { handlingInstructions: combinedHandlingInstructions }
    : undefined;

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
  // 20260728_add_delegate_read_access.sql), so a delegate can see documents
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
