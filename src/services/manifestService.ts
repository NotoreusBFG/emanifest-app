import { RcrainfoClient } from "@/lib/rcrainfo/client";
import { getEpaCredentials } from "@/services/epaService";
import { getActiveDelegationForUser, type DelegateSiteType } from "@/services/delegateRepository";
import { getActiveTeamMembershipForUser } from "@/services/teamRepository";
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
   * account normally, or the delegation/team owner's when acting on their
   * behalf. Callers should record manifests/documents against this id, not
   * blindly against the caller's own id, so an owner's dashboard (and their
   * delegates'/team's later lookups) shows everything consistently in one
   * place. */
  effectiveUserId: string;
  /** Set only when this action is happening through a Quick-Sign delegation
   * (sign-only). Mutually exclusive with `team` below. */
  delegation: { ownerUserId: string; ownerEmail: string } | null;
  /** Set only when this action is happening through a team membership
   * (create + sign + shared workspace, see team_members). Mutually
   * exclusive with `delegation` above. */
  team: { ownerUserId: string; ownerEmail: string } | null;
}

/**
 * Manifest creation, gated by team membership only -- NOT Quick-Sign
 * delegation, which stays sign/lookup-only by design (see
 * docs/delegate-quick-sign-design.md). A team member operates as a full
 * extension of the owner's workspace, so while an active membership
 * exists it takes precedence even over the caller's own credentials (no
 * blended view — see team_members migration's comment).
 */
export async function getRcrainfoClientForCreate(
  supabase: SupabaseClient,
  userId: string
): Promise<ResolvedClient> {
  const membership = await getActiveTeamMembershipForUser(supabase, userId);
  if (membership) {
    const ownerCredentials = await getEpaCredentials(supabase, membership.ownerUserId);
    if (!ownerCredentials) throw new NoCredentialsError();
    return {
      client: clientFor(ownerCredentials),
      effectiveUserId: membership.ownerUserId,
      delegation: null,
      team: { ownerUserId: membership.ownerUserId, ownerEmail: membership.ownerEmail },
    };
  }

  const ownCredentials = await getEpaCredentials(supabase, userId);
  if (!ownCredentials) throw new NoCredentialsError();
  return { client: clientFor(ownCredentials), effectiveUserId: userId, delegation: null, team: null };
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
  // Team membership takes precedence over the caller's own credentials
  // (see getRcrainfoClientForCreate's comment) -- unscoped, no siteType
  // restriction, since a team member is a full extension of the owner.
  const membership = await getActiveTeamMembershipForUser(supabase, userId);
  if (membership) {
    const ownerCredentials = await getEpaCredentials(supabase, membership.ownerUserId);
    if (!ownerCredentials) throw new NoCredentialsError();
    return {
      client: clientFor(ownerCredentials),
      effectiveUserId: membership.ownerUserId,
      delegation: null,
      team: { ownerUserId: membership.ownerUserId, ownerEmail: membership.ownerEmail },
    };
  }

  const ownCredentials = await getEpaCredentials(supabase, userId);
  if (ownCredentials) {
    return { client: clientFor(ownCredentials), effectiveUserId: userId, delegation: null, team: null };
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
    team: null,
  };
}
