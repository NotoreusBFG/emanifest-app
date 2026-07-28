/**
 * One-off upload of the landing page's short explainer video to Vercel
 * Blob. Same pattern as upload-onboarding-videos.ts -- requires
 * BLOB_READ_WRITE_TOKEN in .env.local. Run once, paste the printed URL
 * into src/lib/landingVideo.ts.
 */
import { readFileSync } from "fs";
import path from "path";
import { put } from "@vercel/blob";

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Missing BLOB_READ_WRITE_TOKEN in .env.local.");
    process.exit(1);
  }

  const filePath = path.join(__dirname, "../external-review/Navigating_the_EPA_e-Manifest_Transition.mp4");
  const bytes = readFileSync(filePath);
  console.log(`Uploading (${(bytes.length / 1_000_000).toFixed(1)} MB)...`);
  const blob = await put("landing/navigating-epa-transition.mp4", bytes, {
    access: "public",
    addRandomSuffix: false,
    contentType: "video/mp4",
  });
  console.log(`\nPaste into src/lib/landingVideo.ts:\n\nexport const LANDING_VIDEO_URL = "${blob.url}";`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
