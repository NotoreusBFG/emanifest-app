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
