import crypto from "crypto";

/**
 * Shared 4-digit verification-code generator/compare, backing three
 * distinct uses in this app: the per-manifest MMIN (ManifestMate
 * Identification Number — recordManifestLocally in manifestRepository.ts,
 * shown on generator/transporter dashboards, relayed verbally at signing
 * time — see 20260824_add_mmin_to_manifests.sql), and per-invite codes for
 * the generator-delegate and manifest-prep-delegate one-time-link flows.
 * Same security shape throughout: random, encrypted at rest (not hashed,
 * since it must be displayed), relayed out-of-band from the link itself.
 */
export function generateVerificationCode(): string {
  return String(crypto.randomInt(0, 10000)).padStart(4, "0");
}

/** Constant-time compare so a wrong-length or wrong-value guess can't be timed apart. */
export function timingSafeCompareCode(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
