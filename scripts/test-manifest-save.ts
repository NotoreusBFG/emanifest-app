/**
 * Standalone diagnostic script — NOT part of the app itself.
 *
 * Calls RcrainfoClient.saveManifest() directly with the test fixture, so you
 * can see the real validation error (or success) without building any UI
 * first. Run this from the repo root.
 *
 * Usage (Node 20.6+, which supports --env-file natively):
 *   node --env-file=.env.local --experimental-strip-types scripts/test-manifest-save.ts
 *
 * If that flag combo isn't available in your Node version, run with tsx
 * instead (install once: npm install -D tsx):
 *   npx tsx --env-file=.env.local scripts/test-manifest-save.ts
 *
 * Requires .env.local to already have RCRAINFO_API_ID and RCRAINFO_API_KEY
 * set (see src/lib/rcrainfo/README.md). Regenerate a fresh key first if the
 * one you've been using was shared anywhere outside your own machine.
 */

import { RcrainfoClient } from "../src/lib/rcrainfo/client";
import { buildTestManifest } from "../src/lib/rcrainfo/manifest-fixtures";
import { RcrainfoApiError } from "../src/lib/rcrainfo/types";

async function main() {
  const apiId = process.env.RCRAINFO_API_ID;
  const apiKey = process.env.RCRAINFO_API_KEY;

  if (!apiId || !apiKey) {
    console.error(
      "Missing RCRAINFO_API_ID or RCRAINFO_API_KEY. Make sure .env.local is set and you're passing --env-file=.env.local."
    );
    process.exit(1);
  }

  const client = new RcrainfoClient({
    environment: "preprod",
    credentials: { apiId, apiKey },
  });

  const testManifest = buildTestManifest();

  console.log("Attempting saveManifest() with test fixture:");
  console.log(JSON.stringify(testManifest, null, 2));
  console.log("\n--- Calling API ---\n");

  try {
    const result = await client.saveManifest(testManifest);
    console.log("SUCCESS. Manifest saved:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    if (err instanceof RcrainfoApiError) {
      console.error(`FAILED — HTTP ${err.status}`);
      console.error("Response body (this is the useful part):");
      console.error(JSON.stringify(err.body, null, 2));
    } else {
      console.error("Unexpected error (not an RcrainfoApiError):", err);
    }
    process.exit(1);
  }
}

main();
