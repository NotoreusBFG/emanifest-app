import crypto from "crypto";

/**
 * ManifestMate Identification Number — a random 4-digit code generated
 * once per manifest (see recordManifestLocally in manifestRepository.ts),
 * shown on both the generator's and transporter's dashboards, and relayed
 * verbally to the driver at signing time. Replaces the old company-wide
 * transporters.pin_hash gate — see 20260824_add_mmin_to_manifests.sql for
 * why a per-manifest code is a narrower blast radius than one long-lived
 * shared secret.
 */
export function generateMmin(): string {
  return String(crypto.randomInt(0, 10000)).padStart(4, "0");
}

/** Constant-time compare so a wrong-length or wrong-value guess can't be timed apart. */
export function timingSafeCompareMmin(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
