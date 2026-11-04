/**
 * The Dev Dashboard is an internal view, so it is shown only outside
 * production. VERCEL_ENV is "production" only on a production deployment
 * (hazwastemanifestmate.com); dev.hazwastemanifestmate.com is a Preview
 * build and local runs have no VERCEL_ENV, so both count as non-production.
 * Callers must also require an admin; this check alone is not authorization.
 */
export function isNonProductionEnvironment(): boolean {
  return process.env.VERCEL_ENV !== "production";
}
