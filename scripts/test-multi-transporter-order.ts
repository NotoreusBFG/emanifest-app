/**
 * Live-verifies whether RCRAInfo enforces Transporter 1 signing before
 * Transporter 2, the same way Generator -> Transporter -> Tsdf order is
 * already confirmed enforced. Never tested in this project before -- only
 * a single transporter (order 1) has ever been signed live.
 *
 * Constraint: this account only has confirmed Site Services Permission for
 * one site (VAD000532119). To isolate the ORDER enforcement question from
 * the PERMISSION question, this test lists that same authorized site as
 * BOTH Transporter 1 and Transporter 2 on one manifest -- artificial (one
 * company wouldn't really appear twice), but it lets us test order logic
 * in isolation, since permission is identical for both slots.
 */
import { RcrainfoClient } from "../src/lib/rcrainfo/client";
import { buildTestManifest } from "../src/lib/rcrainfo/manifest-fixtures";
import { RcrainfoApiError } from "../src/lib/rcrainfo/types";

const AUTHORIZED_SITE = "VAD000532119";

async function main() {
  const client = new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: {
      apiId: process.env.RCRAINFO_API_ID!,
      apiKey: process.env.RCRAINFO_API_KEY!,
    },
  });

  const manifest = buildTestManifest();
  manifest.transporters = [
    { epaSiteId: AUTHORIZED_SITE, name: "TEST TSDF OF VA", order: 1 },
    { epaSiteId: AUTHORIZED_SITE, name: "TEST TSDF OF VA", order: 2 },
  ];

  console.log("--- Saving manifest with two transporter slots (same site, order 1 and 2) ---");
  const saveResult = await client.saveManifest(manifest);
  const mtn = saveResult.manifestTrackingNumber;
  console.log("Saved:", mtn, saveResult.operationStatus);

  console.log("\n--- Attempting to sign Transporter ORDER 2 first (should fail if order is enforced) ---");
  try {
    const result = await client.signManifest({
      siteId: AUTHORIZED_SITE,
      siteType: "Transporter",
      transporterOrder: 2,
      printedSignatureName: "Test Signer",
      printedSignatureDate: new Date().toISOString(),
      manifestTrackingNumbers: [mtn],
    });
    console.log("UNEXPECTED SUCCESS signing order 2 first:", JSON.stringify(result, null, 2));
  } catch (err) {
    if (err instanceof RcrainfoApiError) {
      console.log("Failed as expected (or for some other reason) — body:", JSON.stringify(err.body));
    } else {
      console.log("Unexpected error type:", err);
    }
  }

  console.log("\n--- Signing Generator first (required before any transporter can sign) ---");
  try {
    await client.signManifest({
      siteId: AUTHORIZED_SITE,
      siteType: "Generator",
      printedSignatureName: "Test Signer",
      printedSignatureDate: new Date().toISOString(),
      manifestTrackingNumbers: [mtn],
    });
    console.log("Generator signed.");
  } catch (err) {
    console.log("Generator sign failed:", err instanceof RcrainfoApiError ? JSON.stringify(err.body) : err);
  }

  console.log("\n--- Retrying Transporter ORDER 2 (generator has now signed, but order 1 transporter still hasn't) ---");
  try {
    const result = await client.signManifest({
      siteId: AUTHORIZED_SITE,
      siteType: "Transporter",
      transporterOrder: 2,
      printedSignatureName: "Test Signer",
      printedSignatureDate: new Date().toISOString(),
      manifestTrackingNumbers: [mtn],
    });
    console.log("UNEXPECTED SUCCESS signing order 2 before order 1:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.log("Failed as expected (or for some other reason) — body:", err instanceof RcrainfoApiError ? JSON.stringify(err.body) : err);
  }

  console.log("\n--- Signing Transporter ORDER 1 ---");
  try {
    const result = await client.signManifest({
      siteId: AUTHORIZED_SITE,
      siteType: "Transporter",
      transporterOrder: 1,
      printedSignatureName: "Test Signer",
      printedSignatureDate: new Date().toISOString(),
      manifestTrackingNumbers: [mtn],
    });
    console.log("Order 1 signed:", JSON.stringify(result.manifestReports, null, 2));
  } catch (err) {
    console.log("Order 1 sign failed:", err instanceof RcrainfoApiError ? JSON.stringify(err.body) : err);
  }

  console.log("\n--- NOW retrying Transporter ORDER 2 (order 1 has signed) ---");
  try {
    const result = await client.signManifest({
      siteId: AUTHORIZED_SITE,
      siteType: "Transporter",
      transporterOrder: 2,
      printedSignatureName: "Test Signer",
      printedSignatureDate: new Date().toISOString(),
      manifestTrackingNumbers: [mtn],
    });
    console.log("SUCCESS signing order 2 after order 1:", JSON.stringify(result.manifestReports, null, 2));
  } catch (err) {
    console.log("Order 2 sign failed even after order 1 signed:", err instanceof RcrainfoApiError ? JSON.stringify(err.body) : err);
  }

  console.log("\n--- Final manifest state ---");
  const final = await client.getManifest(mtn);
  console.log("status:", final.status);
  console.log("transporters:", final.transporters.map((t) => ({ order: t.order, hasSignature: !!(t as any).electronicSignaturesInfo?.some((e: any) => e.signer) })));
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
