import { writeFileSync } from "fs";
import { RcrainfoClient } from "../src/lib/rcrainfo/client";

async function main() {
  const client = new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: {
      apiId: process.env.RCRAINFO_API_ID!,
      apiKey: process.env.RCRAINFO_API_KEY!,
    },
  });

  const mtn = process.argv[2] ?? "100091730ELC";
  const parts = await client.getManifestAttachments(mtn);
  console.log(`MTN: ${mtn}`);
  console.log(`Got ${parts.length} part(s):`);

  for (const [i, part] of parts.entries()) {
    console.log(`\nPart ${i}: contentType=${part.contentType} contentDisposition=${part.contentDisposition ?? "(none)"}`);
    if (part.contentType === "application/octet-stream" && Buffer.isBuffer(part.data)) {
      const outPath = `/tmp/manifest-attachment-${mtn}-${i}.zip`;
      writeFileSync(outPath, part.data);
      console.log(`  Wrote ${part.data.length} bytes to ${outPath}`);
    } else {
      console.log(JSON.stringify(part.data, null, 2).slice(0, 500));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
