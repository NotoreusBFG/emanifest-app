import { RcrainfoClient } from "../src/lib/rcrainfo/client";
import type { QuickerSignParameters } from "../src/lib/rcrainfo/types";

const MTN = "100091730ELC";

async function main() {
  const client = new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: {
      apiId: process.env.RCRAINFO_API_ID!,
      apiKey: process.env.RCRAINFO_API_KEY!,
    },
  });

  const siteId = process.argv[2] ?? "VAD000532119";
  const siteType = (process.argv[3] as QuickerSignParameters["siteType"]) ?? "Generator";
  const transporterOrder = process.argv[4] ? Number(process.argv[4]) : undefined;

  const params: QuickerSignParameters = {
    manifestTrackingNumbers: [MTN],
    siteId,
    siteType,
    printedSignatureName: "Test Contact", // matches fixture's contact.firstName/lastName
    printedSignatureDate: new Date().toISOString(),
    ...(transporterOrder !== undefined ? { transporterOrder } : {}),
  };

  console.log("Signing as Generator with params:", params);
  const result = await client.signManifest(params);
  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
