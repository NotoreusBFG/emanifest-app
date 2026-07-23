import { RcrainfoClient } from "../src/lib/rcrainfo/client";
import type { Manifest } from "../src/lib/rcrainfo/types";

const MTN = "100091730ELC";
const TEST_INSTRUCTIONS =
  "TEST HANDLING INSTRUCTIONS — keep upright, do not stack, driver call site 30 min prior to arrival.";

async function main() {
  const client = new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: {
      apiId: process.env.RCRAINFO_API_ID!,
      apiKey: process.env.RCRAINFO_API_KEY!,
    },
  });

  const current = await client.getManifest(MTN);
  console.log("Current status:", current.status, "locked:", current.locked);

  // containerNumber/containerType are optional at save but REQUIRED at update.
  const updated: Manifest = {
    ...current,
    additionalInfo: { handlingInstructions: TEST_INSTRUCTIONS },
    wastes: current.wastes.map((w) => ({
      ...w,
      quantity: { ...w.quantity, containerNumber: 1, containerType: { code: "DM" } },
    })),
  };

  const result = await client.updateManifest(updated);
  console.log("operationStatus:", result.operationStatus);
  console.log("warnings:", JSON.stringify(result.warnings, null, 2));
  console.log("wasteReports:", JSON.stringify(result.wasteReports, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
