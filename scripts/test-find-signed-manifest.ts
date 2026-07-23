import { RcrainfoClient } from "../src/lib/rcrainfo/client";

async function main() {
  const client = new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: {
      apiId: process.env.RCRAINFO_API_ID!,
      apiKey: process.env.RCRAINFO_API_KEY!,
    },
  });

  const mtns = await client.getManifestTrackingNumbers("VAD000532119");
  console.log(`Total MTNs at VAD000532119: ${mtns.length}`);

  // Sample from the start, middle, and end of the list — older entries are
  // more likely to have completed their full sign lifecycle by now.
  const sampleSize = 15;
  const sample = [
    ...mtns.slice(0, sampleSize),
    ...mtns.slice(Math.floor(mtns.length / 2), Math.floor(mtns.length / 2) + sampleSize),
    ...mtns.slice(-sampleSize),
  ];

  const statusCounts: Record<string, number> = {};
  const signedExamples: string[] = [];

  for (const mtn of sample) {
    try {
      const manifest = await client.getManifest(mtn);
      const status = manifest.status;
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      if (status === "Signed") {
        signedExamples.push(mtn);
      }
    } catch (err) {
      statusCounts["ERROR"] = (statusCounts["ERROR"] ?? 0) + 1;
    }
  }

  console.log("\nStatus counts across sample:", statusCounts);
  console.log("\nSigned examples found:", signedExamples);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
