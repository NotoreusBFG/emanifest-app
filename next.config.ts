import type { NextConfig } from "next";

/* ---------------------------------------------------------------------------
 * SECURITY HEADERS — Mirrored from Pivot CRM/Aegis CRM
 *
 * Adds security headers that match the CRMs: X-Content-Type-Options,
 * X-Frame-Options, Referrer-Policy, Permissions-Policy, and CSP.
 *
 * The CSP is REPORT-ONLY on purpose. Next.js injects inline bootstrap scripts
 * and Tailwind injects styles, so an enforced policy will blank the app until
 * nonce/hash work is done properly. Report-only cannot break anything. Read
 * the browser console for violations, fix what it reports, then flip
 * `Content-Security-Policy-Report-Only` to `Content-Security-Policy` and drop
 * 'unsafe-inline'/'unsafe-eval' from script-src.
 * ------------------------------------------------------------------------- */
const SECURITY_HEADERS_VERSION = "2026-10-05.1";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase and EPA RCRAInfo API
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://rcrainfopreprod.epa.gov https://rcrainfo.epa.gov",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Security-Headers-Version", value: SECURITY_HEADERS_VERSION },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // Produces a minimal, self-contained server bundle (.next/standalone) --
  // only the production dependencies actually used, not the full
  // node_modules tree. Required for a lean Docker image; has no effect on
  // the existing Vercel deployment path, which ignores this setting.
  output: "standalone",
  experimental: {
    serverActions: {
      // Default is 1MB, too small for a real scanned PDF (LDR attachment
      // upload in src/app/actions/ldrActions.ts) submitted via Server
      // Action FormData. Capped at 4MB, not higher, because Vercel's
      // serverless functions hard-cap request bodies around 4.5MB
      // regardless of this setting — raising it further would just move
      // the failure from a clean client-side error to an opaque 413 from
      // the platform.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
