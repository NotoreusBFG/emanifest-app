import type { NextConfig } from "next";

// Security headers, adapted from the CRMs' canonical block
// (riverlock/pivot/web/next.config.ts, version 2026-09-25.1).
// CSP is REPORT-ONLY on purpose: Next injects inline bootstrap scripts, so an
// enforced policy would break the app until nonces/hashes are done. Watch the
// browser console for violations, then flip to enforcing.
const SECURITY_HEADERS_VERSION = "2026-10-04.1";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // Vercel Blob hosts the public images/attachments.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Browser-side calls only. Resend/Twilio/EPA calls are server-side and not governed by CSP.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.public.blob.vercel-storage.com",
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
      // regardless of this setting -- raising it further would just move
      // the failure from a clean client-side error to an opaque 413 from
      // the platform.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
