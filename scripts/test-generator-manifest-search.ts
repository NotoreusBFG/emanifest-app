import { RcrainfoClient } from "../src/lib/rcrainfo/client";

async function main() {
  const client = new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: {
      apiId: process.env.RCRAINFO_API_ID!,
      apiKey: process.env.RCRAINFO_API_KEY!,
    },
  });

  const SHARED_SANDBOX_SITE = "VAD000532119"; // already known-accessible per client.ts:196-199

  console.log("--- siteId only (no filters) ---");
  try {
    const result = await client.searchManifests({
      siteId: SHARED_SANDBOX_SITE,
      siteType: "Generator",
    });
    console.log(`Got ${result.length} MTNs. First 5:`, result.slice(0, 5));
  } catch (err) {
    console.error("FAILED:", err);
  }

  console.log("--- siteId + status Signed ---");
  try {
    const result = await client.searchManifests({
      siteId: SHARED_SANDBOX_SITE,
      siteType: "Generator",
      status: "Signed",
    });
    console.log(`Got ${result.length} MTNs (status=Signed). First 5:`, result.slice(0, 5));
  } catch (err) {
    console.error("FAILED:", err);
  }

  console.log("--- siteId + date range (UpdatedDate, last 90 days) ---");
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    const result = await client.searchManifests({
      siteId: SHARED_SANDBOX_SITE,
      siteType: "Generator",
      dateType: "UpdatedDate",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    console.log(`Got ${result.length} MTNs (last 90 days). First 5:`, result.slice(0, 5));
  } catch (err) {
    console.error("FAILED:", err);
  }

  console.log("--- siteId + narrow date range (last 7 days), to compare count shrinks ---");
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const result = await client.searchManifests({
      siteId: SHARED_SANDBOX_SITE,
      siteType: "Generator",
      dateType: "UpdatedDate",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    console.log(`Got ${result.length} MTNs (last 7 days). First 5:`, result.slice(0, 5));
  } catch (err) {
    console.error("FAILED:", err);
  }

  console.log("--- invalid/unrelated-looking siteId (format-valid but likely bogus) ---");
  try {
    const result = await client.searchManifests({
      siteId: "ZZD999999999",
      siteType: "Generator",
    });
    console.log(`Got ${result.length} MTNs for bogus site.`, result.slice(0, 5));
  } catch (err) {
    console.error("FAILED (expected for a nonexistent site):", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
