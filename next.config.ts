import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained server bundle (.next/standalone) --
  // only the production dependencies actually used, not the full
  // node_modules tree. Required for a lean Docker image; has no effect on
  // the existing Vercel deployment path, which ignores this setting.
  output: "standalone",
};

export default nextConfig;
