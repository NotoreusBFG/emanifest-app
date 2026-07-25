import { RcrainfoClient } from "@/lib/rcrainfo/client";
import { getEpaCredentials } from "@/services/epaService";
import { getActiveDelegationForUser, type DelegateSiteType } from "@/services/delegateRepository";
import type { SupabaseClient } from "@supabase/supabase-js";

export class NoCredentialsError extends Error {
  constructor() {
    super("No RCRAInfo API credentials saved yet — visit Settings first.");
    this.name = "NoCredentialsError";
  }
}

export class DelegationScopeError extends Error {
  constructor(siteType: string) {
    super(
      `Your Quick-Sign access doesn't cover signing as ${siteType} — ask whoever invited you to extend it.`
    );
    this.name = "DelegationScopeError";
  }
}

function clientFor(credentials: { apiId: string; apiKey: string }) {
  return new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: { apiId: credentials.apiId, apiKey: credentials.apiKey },
  });
}

/** Builds an RcrainfoClient using the logged-in user's own stored credentials.
 * Deliberately NOT delegation-aware — used for lookups, search, and manifest
 * creation, which stay scoped to a user's own EPA registration. Only signing
 * (getRcrainfoClientForSigner below) can act through a delegated owner's
 * credentials, matching this feature's actual scope: "Quick-Sign," not
 * full account access. */
export async function getRcrainfoClientForUser(supabase: SupabaseClient, userId: string) {
  const credentials = await getEpaCredentials(supabase, userId);
  if (!credentials) throw new NoCredentialsError();
  return clientFor(credentials);
}

export interface SignerResolution {
  client: RcrainfoClient;
  /** Whose account this sign action's data belongs to — the delegate's own
   * account normally, or the delegation owner's when signing on their
   * behalf. Callers should record manifests/documents against this id, not
   * blindly against the caller's own id, so an owner's dashboard shows
   * everything their delegates signed. */
  effectiveUserId: string;
  /** Set only when this sign is happening through a delegation. */
  delegation: { ownerUserId: string; ownerEmail: string } | null;
}

/**
 * Resolves credentials for a sign action specifically: the caller's own
 * credentials if they have them, otherwise an active Quick-Sign delegation's
 * owner credentials (see docs/delegate-quick-sign-design.md). Throws
 * DelegationScopeError if the delegate's allowed_site_types doesn't cover
 * the role they're trying to sign as — checked here, not left to RCRAInfo's
 * own (coarser, account-level) permission check.
 */
export async function getRcrainfoClientForSigner(
  supabase: SupabaseClient,
  userId: string,
  siteType: DelegateSiteType
): Promise<SignerResolution> {
  const ownCredentials = await getEpaCredentials(supabase, userId);
  if (ownCredentials) {
    return { client: clientFor(ownCredentials), effectiveUserId: userId, delegation: null };
  }

  const delegation = await getActiveDelegationForUser(supabase, userId);
  if (!delegation) throw new NoCredentialsError();

  if (delegation.allowedSiteTypes && !delegation.allowedSiteTypes.includes(siteType)) {
    throw new DelegationScopeError(siteType);
  }

  const ownerCredentials = await getEpaCredentials(supabase, delegation.ownerUserId);
  if (!ownerCredentials) throw new NoCredentialsError();

  return {
    client: clientFor(ownerCredentials),
    effectiveUserId: delegation.ownerUserId,
    delegation: { ownerUserId: delegation.ownerUserId, ownerEmail: delegation.ownerEmail },
  };
}
