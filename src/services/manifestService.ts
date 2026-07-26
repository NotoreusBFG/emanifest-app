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

/** Builds an RcrainfoClient using the logged-in user's own stored credentials
 * only — never falls back to a delegation. Used for manifest *creation*
 * specifically, which stays a bigger permission than "Quick-Sign" and is
 * deliberately not delegable in v1 (see docs/delegate-quick-sign-design.md).
 * Lookup/search/sign all go through getRcrainfoClientForAction below. */
export async function getRcrainfoClientForUser(supabase: SupabaseClient, userId: string) {
  const credentials = await getEpaCredentials(supabase, userId);
  if (!credentials) throw new NoCredentialsError();
  return clientFor(credentials);
}

export interface ResolvedClient {
  client: RcrainfoClient;
  /** Whose account this action's local data belongs to — the caller's own
   * account normally, or the delegation owner's when acting on their
   * behalf. Callers should record manifests/documents against this id, not
   * blindly against the caller's own id, so an owner's dashboard (and their
   * delegates' later lookups) shows everything consistently in one place. */
  effectiveUserId: string;
  /** Set only when this action is happening through a delegation. */
  delegation: { ownerUserId: string; ownerEmail: string } | null;
}

/**
 * Resolves credentials for any action a Quick-Sign delegate can legitimately
 * perform — looking up a manifest to find what needs signing, and signing
 * itself. Uses the caller's own credentials if they have them, otherwise an
 * active delegation's owner credentials (see
 * docs/delegate-quick-sign-design.md). Pass `siteType` when the action is
 * role-specific (signing) so DelegationScopeError can reject a delegate
 * trying to sign a role outside their allowed_site_types; omit it for
 * role-agnostic actions (lookup) where there's nothing to scope yet.
 */
export async function getRcrainfoClientForAction(
  supabase: SupabaseClient,
  userId: string,
  siteType?: DelegateSiteType
): Promise<ResolvedClient> {
  const ownCredentials = await getEpaCredentials(supabase, userId);
  if (ownCredentials) {
    return { client: clientFor(ownCredentials), effectiveUserId: userId, delegation: null };
  }

  const delegation = await getActiveDelegationForUser(supabase, userId);
  if (!delegation) throw new NoCredentialsError();

  if (siteType && delegation.allowedSiteTypes && !delegation.allowedSiteTypes.includes(siteType)) {
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
