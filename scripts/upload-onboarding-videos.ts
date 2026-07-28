/**
 * One-off upload of the 5 onboarding step videos to Vercel Blob. Requires
 * BLOB_READ_WRITE_TOKEN in .env.local (from the Vercel dashboard's Storage
 * tab -- create a Blob store, connect it to this project, copy the token).
 *
 * Run once, then paste the printed URLs into src/lib/onboardingVideos.ts.
 * Not wired into the build -- this is a manual publishing step, not
 * something that needs to run again unless the source videos change.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { put } from "@vercel/blob";

const SOURCE_DIR = path.join(__dirname, "../external-review/Onboarding");

const FILES: { step: number; filename: string }[] = [
  { step: 1, filename: "Step_1__Establish_CDX_Account.mp4" },
  { step: 2, filename: "Step_2__RCRA_EPA_ID.mp4" },
  { step: 3, filename: "Step_3__Site_Manager_Setup.mp4" },
  { step: 4, filename: "Step_4__API_Credentials.mp4" },
  { step: 5, filename: "Step_5__Paste___Verify_API_Credentials.mp4" },
];

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Missing BLOB_READ_WRITE_TOKEN in .env.local -- see the comment at the top of this file.");
    process.exit(1);
  }

  const results: { step: number; url: string }[] = [];

  for (const { step, filename } of FILES) {
    const filePath = path.join(SOURCE_DIR, filename);
    if (!existsSync(filePath)) {
      console.error(`Skipping step ${step}: not found at ${filePath}`);
      continue;
    }

    const bytes = readFileSync(filePath);
    console.log(`Uploading step ${step} (${(bytes.length / 1_000_000).toFixed(1)} MB)...`);
    const blob = await put(`onboarding/step-${step}.mp4`, bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType: "video/mp4",
    });
    results.push({ step, url: blob.url });
    console.log(`  -> ${blob.url}`);
  }

  console.log("\nPaste this into src/lib/onboardingVideos.ts:\n");
  console.log("export const ONBOARDING_VIDEOS: Partial<Record<number, string>> = {");
  for (const { step, url } of results) {
    console.log(`  ${step}: "${url}",`);
  }
  console.log("};");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
