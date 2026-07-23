/**
 * RCRAInfo / e-Manifest API client.
 *
 * Handles:
 *  - Exchanging API ID + Key for a bearer token
 *  - Caching that token in memory and refreshing it before it expires
 *  - A generic authenticated request wrapper with one retry-on-401
 *
 * Usage:
 *   const client = new RcrainfoClient({
 *     environment: "preprod",
 *     credentials: { apiId: process.env.RCRAINFO_API_ID!, apiKey: process.env.RCRAINFO_API_KEY! },
 *   });
 *   const site = await client.getSiteDetails("VAD000532119");
 *
 * IMPORTANT — this client is server-side only. Never import it into a
 * client component or expose apiId/apiKey to the browser. Pair with the
 * @supabase/ssr auth fix from the code review before wiring this into a
 * Server Action, so we know *which user* is making the call.
 */

import type {
  AuthTokenResponse,
  CachedToken,
  Manifest,
  ManifestOperationResult,
  NewManifestInput,
  QuickerSignParameters,
  QuickerSignResult,
  RcrainfoCredentials,
  RcrainfoEnvironment,
  SiteDetails,
} from "./types";
import { RcrainfoApiError } from "./types";
import { extractBoundary, parseMultipartMixed, type MultipartOutputPart } from "./parse-multipart";

const BASE_URLS: Record<RcrainfoEnvironment, string> = {
  preprod: "https://rcrainfopreprod.epa.gov/rcrainfo/rest/api/v1",
  prod: "https://rcrainfo.epa.gov/rcrainfo/rest/api/v1", // confirm exact prod host before go-live
};

/** Refresh this many ms before actual expiration, to avoid edge-of-window failures. */
const TOKEN_REFRESH_SKEW_MS = 60_000;

export interface RcrainfoClientOptions {
  environment: RcrainfoEnvironment;
  credentials: RcrainfoCredentials;
}

export class RcrainfoClient {
  private readonly baseUrl: string;
  private readonly credentials: RcrainfoCredentials;
  private cachedToken: CachedToken | null = null;

  constructor(options: RcrainfoClientOptions) {
    this.baseUrl = BASE_URLS[options.environment];
    this.credentials = options.credentials;
  }

  /**
   * Returns a valid bearer token, fetching a new one if we don't have one
   * cached or the cached one is about to expire.
   */
  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt - TOKEN_REFRESH_SKEW_MS > now) {
      return this.cachedToken.token;
    }

    const { apiId, apiKey } = this.credentials;
    const url = `${this.baseUrl}/auth/${encodeURIComponent(apiId)}/${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const body = await safeJson(res);
      throw new RcrainfoApiError(
        `RCRAInfo auth failed with status ${res.status}`,
        res.status,
        body
      );
    }

    const data = (await res.json()) as AuthTokenResponse;
    this.cachedToken = {
      token: data.token,
      expiresAt: new Date(data.expiration).getTime(),
    };
    return this.cachedToken.token;
  }

  /**
   * Generic authenticated request. Retries once on 401 in case the cached
   * token was invalidated server-side before our local expiry check caught it.
   */
  private async request<T>(
    path: string,
    init: RequestInit = {},
    _isRetry = false
  ): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });

    if (res.status === 401 && !_isRetry) {
      this.cachedToken = null; // force a fresh token
      return this.request<T>(path, init, true);
    }

    if (!res.ok) {
      const body = await safeJson(res);
      throw new RcrainfoApiError(
        `RCRAInfo request failed: ${init.method ?? "GET"} ${path} -> ${res.status}`,
        res.status,
        body
      );
    }

    return (await res.json()) as T;
  }

  /** GET /site-details/{siteId} */
  async getSiteDetails(siteId: string): Promise<SiteDetails> {
    return this.request<SiteDetails>(`/site-details/${encodeURIComponent(siteId)}`);
  }

  /** GET /emanifest/manifest/{manifestTrackingNumber} — full manifest record. */
  async getManifest(manifestTrackingNumber: string): Promise<Manifest> {
    return this.request<Manifest>(
      `/emanifest/manifest/${encodeURIComponent(manifestTrackingNumber)}`
    );
  }

  /**
   * GET /emanifest/manifest-tracking-numbers/{siteId}
   *
   * Confirmed live against Swagger (preprod) this session. Returns a flat
   * array of MTN strings tied to a site — NOT full manifest objects (no
   * status/dates/etc per entry). Confirmed against VAD000532119, which
   * returned several thousand MTNs — this is a shared public EPA sandbox
   * site used by many developers, so treat this as noisy shared data, not
   * clean test data specific to this app. Use manifest creation + a known
   * MTN for reliable dev/test data instead.
   */
  async getManifestTrackingNumbers(siteId: string): Promise<string[]> {
    return this.request<string[]>(
      `/emanifest/manifest-tracking-numbers/${encodeURIComponent(siteId)}`
    );
  }

  /**
   * POST /emanifest/manifest/save
   *
   * Multipart form-data with a `manifest` field (JSON-stringified) and an
   * optional `attachment` file. Returns a `ManifestOperationResult`
   * report — NOT the saved Manifest itself (confirmed live: the response
   * only has `manifestTrackingNumber`/`reportId`/`operationStatus`/
   * `warnings`/per-entity reports, no `generator`/`wastes`/etc). Call
   * `getManifest()` afterward for the actual saved data.
   */
  async saveManifest(manifest: NewManifestInput, attachment?: Blob): Promise<ManifestOperationResult> {
    const token = await this.getToken();
    const form = new FormData();
    form.append("manifest", JSON.stringify(manifest));
    if (attachment) {
      form.append("attachment", attachment);
    }

    const res = await fetch(`${this.baseUrl}/emanifest/manifest/save`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }, // do NOT set Content-Type — fetch sets the multipart boundary automatically
      body: form,
    });

    if (!res.ok) {
      const body = await safeJson(res);
      throw new RcrainfoApiError(
        `RCRAInfo manifest save failed -> ${res.status}`,
        res.status,
        body
      );
    }

    return (await res.json()) as ManifestOperationResult;
  }

  /**
   * PUT /emanifest/manifest/update
   *
   * Updates an existing, not-yet-signed manifest — requires the FULL
   * manifest JSON (not a partial patch), including `manifestTrackingNumber`.
   * Only works while status is `"Pending"` or `"Scheduled"` and the
   * manifest isn't locked for signing; fails with `E_ManifestLockedAsyncSign`
   * once it's in the signing queue.
   *
   * CONFIRMED LIVE 2026-07-23, and EPA's own docs page
   * (`docs/Services/Manifest/update.md`) got BOTH of the following wrong:
   *   1. Method: docs' example shows `POST`; live API returns 405 for
   *      that and an `OPTIONS` probe confirmed `Allow: OPTIONS,PUT`.
   *   2. Body format: docs' example shows a plain `application/json`
   *      body; live API rejects that (and `text/plain`, unlike
   *      `quicker-sign`) with a blanket 415. It actually wants the SAME
   *      multipart form-data shape as `save` — a `manifest` field
   *      containing the JSON-stringified manifest.
   * Also found live: `quantity.containerNumber` and `quantity.containerType`
   * are OPTIONAL on save but REQUIRED on update — stricter validation on
   * this endpoint for fields that were fine to omit at creation time.
   * Response is a validation report, not the updated Manifest — call
   * `getManifest()` afterward to see the actual result.
   */
  async updateManifest(manifest: Manifest): Promise<ManifestOperationResult> {
    const token = await this.getToken();
    const form = new FormData();
    form.append("manifest", JSON.stringify(manifest));

    const res = await fetch(`${this.baseUrl}/emanifest/manifest/update`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` }, // do NOT set Content-Type — fetch sets the multipart boundary automatically
      body: form,
    });

    if (!res.ok) {
      const body = await safeJson(res);
      throw new RcrainfoApiError(
        `RCRAInfo manifest update failed -> ${res.status}`,
        res.status,
        body
      );
    }

    return (await res.json()) as ManifestOperationResult;
  }

  /**
   * GET /emanifest/manifest/{manifestTrackingNumber}/attachments
   *
   * Confirmed via EPA's own emanifest-js reference client
   * (https://github.com/USEPA/e-manifest/blob/master/emanifest-js/src/client.ts)
   * — NOT documented with a request/response shape in Swagger itself. The
   * response is `multipart/mixed`: one JSON part (manifest data) plus one
   * `application/octet-stream` part containing a .zip file. The zip holds
   * whatever document(s) RCRAInfo has for this manifest — for a fully
   * electronic manifest this includes the auto-generated
   * `human-readable.html` referenced in `electronicSignaturesInfo`.
   */
  async getManifestAttachments(manifestTrackingNumber: string): Promise<MultipartOutputPart[]> {
    const token = await this.getToken();
    const res = await fetch(
      `${this.baseUrl}/emanifest/manifest/${encodeURIComponent(manifestTrackingNumber)}/attachments`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const body = await safeJson(res);
      throw new RcrainfoApiError(
        `RCRAInfo manifest attachments fetch failed -> ${res.status}`,
        res.status,
        body
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    const boundary = extractBoundary(contentType);
    if (!boundary) {
      throw new Error(`No multipart boundary found in Content-Type header: "${contentType}"`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return parseMultipartMixed(buffer, boundary);
  }

  /**
   * POST /emanifest/manifest/quicker-sign
   *
   * CONFIRMED LIVE 2026-07-23. Does NOT use the generic `request()` helper
   * because this endpoint is oddly picky about Content-Type: sending
   * `application/json` (what `request()` always sets when a body is
   * present) gets rejected with a generic Tomcat 415, even though the body
   * IS JSON. It only works with `Content-Type: text/plain;charset=UTF-8`.
   * Undocumented anywhere — found by trial and error after `request()`
   * failed. See `QuickerSignParameters` for other field-naming gotchas.
   */
  async signManifest(params: QuickerSignParameters): Promise<QuickerSignResult> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/emanifest/manifest/quicker-sign`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain;charset=UTF-8",
        Accept: "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const body = await safeJson(res);
      throw new RcrainfoApiError(
        `RCRAInfo quicker-sign failed -> ${res.status}`,
        res.status,
        body
      );
    }

    return (await res.json()) as QuickerSignResult;
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
