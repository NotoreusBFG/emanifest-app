/**
 * Live-verifies open item #1 from docs/NEXT_SESSION.md: does RCRAInfo accept
 * epaWaste: false on a line where dotHazardous: true? Only the opposite
 * direction (epaWaste can't be true when dotHazardous is false) was
 * previously confirmed live — this fixes that gap for the new "RCRA waste"
 * checkbox in the manifest form, which can now send exactly this
 * combination (DOT-hazardous material that isn't a RCRA hazardous waste).
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
  // The change under test: DOT-hazardous but explicitly NOT a RCRA waste
  // (e.g. solid sodium hydroxide — hazardous material, not a listed/
  // characteristic hazardous waste). Drop the federal waste codes too,
  // since D/F/K/P codes are a RCRA-waste concept and wouldn't apply here.
  manifest.wastes[0].epaWaste = false;
  manifest.wastes[0].hazardousWaste = undefined;
  manifest.wastes[0].dotInformation!.printedDotInformation =
    "Sodium hydroxide, solid, 8, UN1823, PG II";

  console.log("wastes[0]:", JSON.stringify(manifest.wastes[0], null, 2));
  console.log("\n--- Calling saveManifest() ---\n");

  try {
    const result = await client.saveManifest(manifest);
    console.log("SUCCESS. operationStatus:", result.operationStatus);
    console.log("MTN:", result.manifestTrackingNumber);
    const warnings = collectManifestOperationWarnings(result);
    console.log(warnings.length ? "Warnings:\n" + warnings.join("\n") : "No warnings.");
  } catch (err) {
    if (err instanceof RcrainfoApiError) {
      console.error(`FAILED — HTTP ${err.status}`);
      console.error(JSON.stringify(err.body, null, 2));
    } else {
      console.error("Unexpected error:", err);
    }
    process.exit(1);
  }
}

main();
