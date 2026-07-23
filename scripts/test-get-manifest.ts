import { RcrainfoClient } from "../src/lib/rcrainfo/client";

async function main() {
  const client = new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: {
      apiId: process.env.RCRAINFO_API_ID!,
      apiKey: process.env.RCRAINFO_API_KEY!,
    },
  });

  const manifest = await client.getManifest("100091730ELC");
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
