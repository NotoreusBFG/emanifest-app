/**
 * Live-verifies open item #5 / the core claim in
 * docs/manifest-workflow-and-permissions.md: does saving a FullElectronic
 * manifest require the calling account to have Site Services Permission
 * for the named GENERATOR, or only for signing?
 *
 * This account is confirmed authorized for VAD000532119 (TEST TSDF OF VA)
 * but has never been confirmed authorized for VATEST000004 (TEST GENERATOR
 * OF VA, "Generator only" per EPA's public test-site list). If save
 * succeeds naming VATEST000004 as generator, that's live confirmation the
 * doc's claim holds; if it fails with a permission-specific error, the
 * claim was wrong and the doc needs correcting.
 */
import { RcrainfoClient } from "../src/lib/rcrainfo/client";
import { buildTestManifest } from "../src/lib/rcrainfo/manifest-fixtures";
import { RcrainfoApiError, collectManifestOperationWarnings } from "../src/lib/rcrainfo/types";

async function main() {
  const client = new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: {
      apiId: process.env.RCRAINFO_API_ID!,
      apiKey: process.env.RCRAINFO_API_KEY!,
    },
  });

  const manifest = buildTestManifest();
  manifest.generator = {
    epaSiteId: "VATEST000004",
    name: "TEST GENERATOR OF VA",
    mailingAddress: { address1: "1 TEST WAY", city: "ARLINGTON", state: { code: "VA" }, country: { code: "US" }, zip: "22202" },
    siteAddress: { address1: "1 TEST WAY", city: "ARLINGTON", state: { code: "VA" }, country: { code: "US" }, zip: "22202" },
    contact: { firstName: "Test", lastName: "Contact", phone: { number: "703-555-0100" }, email: "test-contact@example.com" },
    emergencyPhone: { number: "703-555-0199" },
  };

  console.log("Generator on this manifest (VATEST000004) is NOT a site this account has Site Services Permission for.");
  console.log("\n--- Calling saveManifest() ---\n");

  try {
    const result = await client.saveManifest(manifest);
    console.log("SUCCESS — save was NOT blocked by lack of generator permission.");
    console.log("operationStatus:", result.operationStatus);
    console.log("MTN:", result.manifestTrackingNumber);
    const warnings = collectManifestOperationWarnings(result);
    console.log(warnings.length ? "Warnings:\n" + warnings.join("\n") : "No warnings.");
  } catch (err) {
    if (err instanceof RcrainfoApiError) {
      console.error(`FAILED — HTTP ${err.status}`);
      console.error(JSON.stringify(err.body, null, 2));
      console.error("\nIf this error mentions permission/authorization for the generator site, the doc's claim was WRONG.");
    } else {
      console.error("Unexpected error:", err);
    }
    process.exit(1);
  }
}

main();
