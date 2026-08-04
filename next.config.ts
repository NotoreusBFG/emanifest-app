import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
