import { RcrainfoClient } from "../src/lib/rcrainfo/client";

async function main() {
  const client = new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: {
      apiId: process.env.RCRAINFO_API_ID!,
      apiKey: process.env.RCRAINFO_API_KEY!,
    },
  });

  console.log("--- name only ---");
  try {
    const result = await client.searchSites({ name: "Clean" });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("FAILED:", err);
  }

  console.log("--- name + siteType Transporter ---");
  try {
    const result = await client.searchSites({ name: "Clean", siteType: "Transporter" });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("FAILED:", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
