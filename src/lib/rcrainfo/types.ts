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
   * CONFIRMED required by live 400 response for hazardous waste lines
   * ("Emanifest.waste.dotInformation — Mandatory Field is Not Provided").
   * A warning in the same response also noted that for hazardous waste,
   * `wasteDescription` gets ignored in favor of this DOT shipping info —
   * so this is the field that actually matters for hazardous lines.
   * The code sub-fields reference EPA's DOT lookup tables — the values
   * below are placeholders, not yet confirmed against a lookup endpoint.
   */
  dotInformation: {
    properShippingName?: { code: string };
    idNumber?: { code: string };
    hazardClass?: { code: string };
    packingGroup?: { code: string };
  };
  hazardousWaste?: {
    federalWasteCodes?: WasteCode[];
    generatorWasteCodes?: WasteCode[];
  };
  /** Biennial Report flag — set false unless you know this waste needs BR data. */
  br?: boolean;
  pcb?: boolean;
  epaWaste?: boolean;
}

/** Minimal payload for POST /emanifest/manifest/save (a new, not-yet-submitted manifest). */
export interface NewManifestInput {
  status: "NotAssigned" | "Pending" | "Scheduled";
  submissionType: "FullElectronic" | "Hybrid" | "Image";
  originType: "Web" | "Service";
  generator: Handler;
  transporters: Handler[];
  designatedFacility: Handler;
  wastes: WasteLine[];
  /**
   * CONFIRMED required by live 400 response ("Emanifest.import — Mandatory
   * Field is Not Provided"). Set false for a standard domestic manifest.
   */
  import: boolean;
  /**
   * NOT confirmed required — added speculatively since `import` was
   * required and RCRAInfo often pairs import/export flags. Remove if the
   * next validation pass doesn't flag it as missing.
   */
  export?: boolean;
  /**
   * REMOVED: a prior version included "shipmentType" here, but the live API
   * rejected it with "Object instance has properties which are not allowed
   * by the schema". It may only appear on retrieved manifests, not save
   * input — do not add it back without re-confirming.
   */
}

/** Full manifest record shape as returned by GET /emanifest/manifest/{mtn}. Loosely typed — see note above. */
export interface Manifest extends NewManifestInput {
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
