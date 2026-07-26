/**
 * Type definitions for the RCRAInfo / e-Manifest REST API.
 *
 * These cover only the endpoints ManifestMate currently uses. Expand as
 * additional endpoints (manifest creation, signing, etc.) come online.
 *
 * Reference: https://rcrainfopreprod.epa.gov/rcrainfo/secured/swagger/
 */

export type RcrainfoEnvironment = "preprod" | "prod";

export interface RcrainfoCredentials {
  apiId: string;
  apiKey: string;
}

export interface AuthTokenResponse {
  token: string;
  /** ISO 8601 timestamp, e.g. "2026-07-22T22:38:25.341+00:00" */
  expiration: string;
}

/** Cached in-memory representation of a live token. */
export interface CachedToken {
  token: string;
  /** Epoch ms — when this token should be treated as expired. */
  expiresAt: number;
}

export interface PhoneNumber {
  number?: string;
  extension?: string;
}

export interface StateCode {
  code?: string;
  name?: string;
}

export interface CountryCode {
  code?: string;
  name?: string;
}

export interface Address {
  streetNumber?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: StateCode;
  foreignState?: { code?: string; countryCode?: string };
  country?: CountryCode;
  zip?: string;
}

export interface SiteContact {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phoneNumber?: PhoneNumber;
  email?: string;
  companyName?: string;
}

/** Response shape for GET /api/v1/site-details/{siteId} */
export interface SiteDetails {
  epaSiteId: string;
  name: string;
  modified?: boolean;
  hasSiteId?: boolean;
  registered?: boolean;
  mailingAddress?: Address;
  siteAddress?: Address;
  contact?: SiteContact;
  emergencyPhone?: PhoneNumber;
  gisPrimary?: boolean;
  canEsign?: boolean;
  limitedEsign?: boolean;
  hasRegisteredEmanifestUser?: boolean;
  siteType?: string;
  federalGeneratorStatus?: string;
  /** ISO date string, e.g. "2018-04-06" */
  lastNotificationDate?: string;
}

/**
 * Response item shape for GET /lookup/federal-waste-codes — CONFIRMED LIVE
 * 2026-07-25 (`docs/Services/Lookup/lookup.md` in the public
 * USEPA/e-manifest repo). 567 real entries as of that test, prefixes
 * D/F/K/L/P/U. This is the authoritative source for what belongs in the
 * manifest's federal waste code field — used to constrain the waste-line
 * form to only real codes instead of free text.
 */
export interface FederalWasteCode {
  code: string;
  description: string;
}

/**
 * Request body for POST /site-search. Per EPA's docs, at least one of
 * epaSiteId/name/streetNumber/address1/city/state/zip must be provided.
 * A 12-character epaSiteId triggers an exact match and all other fields
 * are ignored. `streetNumber` requires `address1`; `address1` requires a
 * valid `city` or `zip`.
 *
 * `siteType` casing CONFIRMED LIVE 2026-07-24: `"Transporter"`, `"Tsdf"`,
 * and `"Broker"` all work (`"Tsdf"`, not the `"TSDF"` shown in EPA's prose
 * docs — matches the reference client and the already-confirmed
 * `QuickerSignParameters` casing).
 */
export interface SiteSearchParams {
  epaSiteId?: string;
  name?: string;
  streetNumber?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  siteType?: "Generator" | "Transporter" | "Tsdf" | "Broker";
  pageNumber?: number;
}

/**
 * Shape of a single site in a POST /site-search response — CONFIRMED LIVE
 * 2026-07-24 (neither EPA's prose docs nor its own `emanifest-js`
 * reference client, which types this `any`, documented it). Turns out to
 * be identical to `SiteDetails` (the `GET /site-details/{siteId}` shape)
 * plus `mailingAddress`/`siteAddress` both present — reusing that type
 * directly rather than a separate near-duplicate.
 */
export type SiteSearchResultItem = SiteDetails;

/**
 * Response shape for POST /site-search — CONFIRMED LIVE 2026-07-24.
 * Pagination fields (`totalNumberOfSites`/`totalNumberOfPages`/
 * `currentPageNumber`) and `searchedParameters` (an ECHO of the request
 * params as `{field, value}` pairs, NOT the request shape itself) were
 * both guessed wrong in the initial unverified version of this type —
 * corrected against a real response.
 */
export interface SiteSearchResponse {
  totalNumberOfSites: number;
  totalNumberOfPages: number;
  currentPageNumber: number;
  searchedParameters: Array<{ field: string; value: string }>;
  sites: SiteSearchResultItem[];
}

/**
 * Known e-Manifest status values. Confirm the exhaustive list against the
 * Swagger "search MTN" endpoint's parameter description before relying on
 * this in production — EPA has added statuses over time.
 */
export type ManifestStatus =
  | "Pending"
  | "Scheduled"
  | "InTransit"
  | "ReadyForSignature"
  | "Signed"
  | "Corrected"
  | "UnderCorrection"
  | "MtnValidationFailed"
  | "Deleted";

export interface ManifestSearchParams {
  siteId: string;
  status?: ManifestStatus;
  /** ISO date, e.g. "2026-01-01" — confirm exact param name against Swagger */
  shippedDateFrom?: string;
  shippedDateTo?: string;
}

/** Minimal shape of a single row returned by the MTN search endpoint. */
export interface ManifestSummary {
  manifestTrackingNumber: string;
  status: ManifestStatus;
  submissionType?: string;
  generatorId?: string;
  designatedFacilityId?: string;
  shippedDate?: string;
  receivedDate?: string;
}

export class RcrainfoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "RcrainfoApiError";
  }
}

/* -------------------------------------------------------------------------
 * Manifest (8700-22) types
 *
 * The full RCRAInfo Manifest schema (confirmed via GET
 * /emanifest/manifest/{manifestTrackingNumber} in Swagger, preprod) is very
 * large — it includes rejection, import/export, and correction-request data
 * that only applies to manifests already in flight. Below is a smaller
 * "input" shape covering what's needed to CREATE a manifest via
 * POST /emanifest/manifest/save. Swagger's schema does not mark which
 * fields are strictly required, so treat this as a reasonable starting
 * payload to test — the API's validation errors on first save attempt are
 * the most reliable way to discover the true required set.
 * ---------------------------------------------------------------------- */

/**
 * Contact shape specifically for MANIFEST SAVE payloads.
 *
 * CONFIRMED via live 400 response: the save schema wants `contact.phone`,
 * NOT `contact.phoneNumber` — different from SiteContact (used by the GET
 * site-details response), which does use `phoneNumber`. Annoying but real
 * inconsistency between this API's GET and POST schemas — don't conflate
 * the two contact shapes.
 */
export interface ManifestContact {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: PhoneNumber;
  email?: string;
  companyName?: string;
}

/** Shared "site" shape — reused by RCRAInfo for generator, transporter, and designated facility. */
/**
 * One entry per signature "slot" for a handler. CONFIRMED LIVE 2026-07-25:
 * this array is present on GET once the workflow reaches a handler, but an
 * entry's mere presence does NOT mean that handler has signed — an
 * unsigned transporter already had one entry containing only
 * `humanReadableDocument`, with no `signer`/`signatureDate` at all. Use
 * `getHandlerSignatureStatus()` below rather than checking this array
 * directly for presence/length.
 */
export interface ElectronicSignatureInfo {
  signer?: { firstName?: string; lastName?: string; userId?: string };
  signatureDate?: string;
  signerRole?: string;
  signatureMethod?: string;
  humanReadableDocument?: { name?: string; size?: number; mimeType?: string };
}

/** Paper-signing equivalent of ElectronicSignatureInfo — untested by this project (only QuickerSign/electronic has been used), modeled for completeness since it appears in the same GET responses. */
export interface PaperSignatureInfo {
  printedName?: string;
  signatureDate?: string;
}

export interface Handler {
  epaSiteId: string;
  /**
   * CONFIRMED required by live 400 response, even for a site RCRAInfo
   * already has on file — a warning in the same response confirms
   * whatever name you submit gets discarded and replaced with the
   * registered value once EPA recognizes the epaSiteId, but the field must
   * still be present and non-empty to pass structural validation.
   */
  name: string;
  mailingAddress?: Address;
  siteAddress?: Address;
  contact?: ManifestContact;
  emergencyPhone?: PhoneNumber;
  /** Only present on a transporter entry — its position in the transport chain. */
  order?: number;
  electronicSignaturesInfo?: ElectronicSignatureInfo[];
  paperSignatureInfo?: PaperSignatureInfo;
}

export interface HandlerSignatureStatus {
  signed: boolean;
  signerName?: string;
  signatureDate?: string;
}

/**
 * See ElectronicSignatureInfo's comment for why this can't just check
 * array presence — an unsigned handler can already have a placeholder
 * entry with no real signer.
 */
export function getHandlerSignatureStatus(handler: Handler): HandlerSignatureStatus {
  const realSignature = handler.electronicSignaturesInfo?.find(
    (entry) => entry.signer && entry.signatureDate
  );
  if (realSignature) {
    return {
      signed: true,
      signerName:
        [realSignature.signer?.firstName, realSignature.signer?.lastName].filter(Boolean).join(" ") ||
        undefined,
      signatureDate: realSignature.signatureDate,
    };
  }

  if (handler.paperSignatureInfo?.signatureDate) {
    return {
      signed: true,
      signerName: handler.paperSignatureInfo.printedName,
      signatureDate: handler.paperSignatureInfo.signatureDate,
    };
  }

  return { signed: false };
}

export interface WasteQuantity {
  containerNumber?: number;
  containerType?: { code: string; description?: string };
  quantity: number;
  unitOfMeasurement: { code: string; description?: string };
}

export interface WasteCode {
  code: string;
  acute?: boolean;
}

export interface WasteLine {
  lineNumber: number;
  /**
   * CONFIRMED via live 400 response: the API rejects a field called
   * "hazardous" and requires "dotHazardous" instead. Renamed accordingly.
   */
  dotHazardous: boolean;
  wasteDescription: string;
  quantity: WasteQuantity;
  /**
   * CONFIRMED required ONLY for hazardous waste lines (`dotHazardous:
   * true`) — omitting it entirely on a non-hazardous line saves cleanly
   * with no error. Structure confirmed via THREE live responses:
   *   1. dotInformation itself is required when dotHazardous is true.
   *   2. The structured sub-objects `properShippingName`, `hazardClass`,
   *      and `packingGroup` are explicitly REJECTED on save ("properties
   *      which are not allowed by the schema") — RCRAInfo instead wants
   *      the full DOT shipping description as ONE printed string via
   *      `printedDotInformation`. `idNumber` was NOT flagged as
   *      disallowed in that same error, so it's left in below as
   *      optional/unconfirmed rather than removed outright.
   *   3. For a non-hazardous line, a save including this field returns
   *      the warning "For non-hazardous Waste Dot Information will be
   *      ignored" — confirms it's meaningless (not just harmless) there.
   */
  dotInformation?: {
    /** CONFIRMED required — e.g. "RQ, Waste flammable liquids, n.o.s. (contains xylene), 3, UN1993, PG II" */
    printedDotInformation: string;
    /** CONFIRMED required (save attempt #4: "Object has missing required properties [\"idNumber\"]"). */
    idNumber: { code: string };
    technicalName?: string;
    rqIndicator?: boolean;
    rqDescription?: string;
  };
  hazardousWaste?: {
    federalWasteCodes?: WasteCode[];
    generatorWasteCodes?: WasteCode[];
  };
  /** Biennial Report flag — set false unless you know this waste needs BR data. */
  br?: boolean;
  pcb?: boolean;
  /**
   * CONFIRMED live: cannot be `true` when `dotHazardous` is `false` —
   * RCRAInfo returns the warning "the Waste.dotHazardous is false the
   * Waste.epaWaste cannot be true" and silently ignores the provided
   * value. Keep these two fields in sync.
   */
  epaWaste?: boolean;
}

/** Minimal payload for POST /emanifest/manifest/save (a new, not-yet-submitted manifest). */
/**
 * Confirmed against EPA's actual JSON schema (`emanifest.json` in the
 * public USEPA/e-manifest repo) — "Entity containing Additional
 * Information. Both Manifest and individual Wastes can contain this
 * entity." Only `handlingInstructions` is modeled here since it's the
 * only sub-field we currently need; the schema also documents
 * `originalManifestTrackingNumbers`, `newManifestDestination`,
 * `consentNumber`, `comments`, and `pcbAlternateDesignatedFacility` for
 * rejection/residue/import-export scenarios we don't handle yet.
 */
export interface AdditionalInfo {
  /** "Special Handling Instructions" per EPA's schema description — max length 4000. Corresponds to Box 14 on Form 8700-22. */
  handlingInstructions?: string;
}

export interface NewManifestInput {
  status: "NotAssigned" | "Pending" | "Scheduled";
  submissionType: "FullElectronic" | "Hybrid" | "Image";
  originType: "Web" | "Service";
  generator: Handler;
  transporters: Handler[];
  designatedFacility: Handler;
  wastes: WasteLine[];
  /** NOT restricted to GET-only (unlike correctionInfo) — should be includable at Save/Update time. Untested by us until now. */
  additionalInfo?: AdditionalInfo;
  /**
   * CONFIRMED required by live 400 response ("Emanifest.import — Mandatory
   * Field is Not Provided"). Set false for a standard domestic manifest.
   */
  import: boolean;
  /**
   * CONFIRMED required, same as `import` — omitting it fails validation.
   * Set false for a standard domestic manifest.
   */
  export: boolean;
  /**
   * REMOVED: a prior version included "shipmentType" here, but the live API
   * rejected it with "Object instance has properties which are not allowed
   * by the schema". It may only appear on retrieved manifests, not save
   * input — do not add it back without re-confirming.
   */
}

/** Full manifest record shape as returned by GET /emanifest/manifest/{mtn}. Loosely typed — see note above. */
export interface Manifest extends Omit<NewManifestInput, "status"> {
  // A fetched manifest's status ranges over the full lifecycle
  // (ManifestStatus) — NewManifestInput.status is deliberately narrower
  // ("NotAssigned" | "Pending" | "Scheduled"), the only values valid to
  // SEND when saving one. Overriding here rather than inheriting avoids
  // silently mistyping every fetched manifest's actual status.
  status: ManifestStatus;
  manifestTrackingNumber: string;
  createdDate?: string;
  updatedDate?: string;
  shippedDate?: string;
  receivedDate?: string;
  ppcStatus?: string;
  locked?: boolean;
  discrepancy?: boolean;
  /** Catch-all for the many additional fields (rejectionInfo, importInfo, exportInfo, correctionInfo, etc.) not modeled here. */
  [key: string]: unknown;
}

/**
 * Response shape for POST /emanifest/manifest/save and PUT
 * /emanifest/manifest/update — CONFIRMED live 2026-07-23 that BOTH
 * endpoints return this same report shape, NOT the saved/updated
 * Manifest itself (despite `save`'s response including
 * `manifestTrackingNumber`, which made it easy to mistake for a full
 * Manifest before we actually inspected the shape). Call `getManifest()`
 * afterward to see the actual persisted data. `operationStatus` seen:
 * `"Saved"`, `"Updated"` (also expect `"Failed"` on validation errors,
 * by analogy with `quicker-sign`).
 */
export interface ManifestOperationResult {
  manifestTrackingNumber: string;
  reportId: string;
  date: string;
  operationStatus: string;
  warnings?: Array<{ field: string; message: string; value?: unknown }>;
  generatorReport?: EntityReport;
  transporterReports?: EntityReport[];
  designatedFacilityReport?: EntityReport;
  wasteReports?: EntityReport[];
}

interface EntityReport {
  entityId?: { entityIdField: string; entityIdValue: string };
  errors: Array<{ field: string; message: string; value?: unknown }>;
  warnings: Array<{ field: string; message: string; value?: unknown }>;
}

/** Flattens every warning across the whole report into simple display strings. */
export function collectManifestOperationWarnings(result: ManifestOperationResult): string[] {
  const messages: string[] = [];
  const push = (label: string, entries?: Array<{ field: string; message: string; value?: unknown }>) => {
    for (const w of entries ?? []) {
      messages.push(`${label}: ${w.message}${w.value !== undefined ? ` (${JSON.stringify(w.value)})` : ""}`);
    }
  };

  push("Manifest", result.warnings);
  push("Generator", result.generatorReport?.warnings);
  push("Designated facility", result.designatedFacilityReport?.warnings);
  result.transporterReports?.forEach((r, i) => push(`Transporter ${i + 1}`, r.warnings));
  result.wasteReports?.forEach((r) => push(`Waste line ${r.entityId?.entityIdValue ?? "?"}`, r.warnings));

  return messages;
}

/**
 * Parameters for POST /emanifest/manifest/quicker-sign — a simplified
 * electronic signature endpoint (as opposed to full CROMERR identity-proofed
 * signing).
 *
 * CONFIRMED LIVE 2026-07-23. Field is `siteId` (lowercase d) — matches
 * EPA's published JSON schema
 * (`Services-Information/Schema/quicker sign.json` in the public
 * USEPA/e-manifest repo), NOT the `siteID` used in that same repo's
 * `emanifest-js/src/types.ts` reference client — the two disagree with
 * each other. `siteType` values confirmed: `"Generator"` works; the
 * others are documented but untested by us.
 *
 * IMPORTANT: the actual signer identity (name, EPA userId) that ends up
 * on the manifest comes from whichever API credentials made the call —
 * NOT from `printedSignatureName`, which is just a printed/display value
 * on the form. `printedSignatureDate` also gets silently normalized to
 * noon UTC of the given day regardless of the time portion sent.
 */
export interface QuickerSignParameters {
  siteId: string;
  siteType: "Generator" | "Transporter" | "Tsdf" | "RejectionInfo_AlternateTsdf";
  printedSignatureName: string;
  /** ISO 8601, e.g. "2026-07-23T12:00:00.000Z" — silently normalized to noon UTC of this date regardless. */
  printedSignatureDate: string;
  manifestTrackingNumbers: string[];
  /** Required only when siteType is "Transporter" — matches the transporter's `order` field on the manifest. */
  transporterOrder?: number;
}

/**
 * Response shape for POST /emanifest/manifest/quicker-sign — CONFIRMED
 * live 2026-07-23. `operationStatus` came back as `"Completed"`, which is
 * NOT one of the three values EPA's own JSON schema documents
 * (`"AllSigned" | "PartiallySigned" | "Failed"`) — treat that enum as
 * unreliable/incomplete.
 */
export interface QuickerSignResult {
  reportId: string;
  date: string;
  operationStatus: string;
  manifestReports: Array<{
    manifestTrackingNumber: string;
    manifestSigned?: { message: string };
    manifestError?: { message: string; field?: string; value?: string };
  }>;
  signerReport: {
    printedSignatureName: string;
    printedSignatureDate: string;
    electronicSignatureDate: string;
    firstName: string;
    lastName: string;
    userId: string;
    warnings?: Array<{ field: string; message: string; value?: string; id?: unknown }>;
  };
  siteReport: {
    siteId: string;
    siteType: string;
    transporterOrder?: number;
  };
}
