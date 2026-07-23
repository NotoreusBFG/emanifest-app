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
  ManifestSummary,
  RcrainfoCredentials,
  RcrainfoEnvironment,
  SiteDetails,
} from "./types";
import { RcrainfoApiError } from "./types";

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

  /**
   * GET /emanifest/manifest-tracking-numbers/{siteId}
   *
   * Confirmed live against Swagger (preprod) this session. Returns the MTNs
   * associated with a site — takes no query params/body, so status/date
   * filtering (if needed) has to happen client-side after this call, or via
   * a separate endpoint if the Swagger doc turns up one that supports it.
   */
  async getManifestTrackingNumbers(siteId: string): Promise<ManifestSummary[]> {
    return this.request<ManifestSummary[]>(
      `/emanifest/manifest-tracking-numbers/${encodeURIComponent(siteId)}`
    );
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
