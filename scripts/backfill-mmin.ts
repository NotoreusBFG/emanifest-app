/**
 * LOCAL-ONLY admin tool — not deployed, never run by the app itself.
 * One-time backfill: generates and encrypts an MMIN for every `manifests`
 * row that predates the mmin_encrypted column (20260824_add_mmin_to_manifests.sql).
 * New rows get one lazily via recordManifestLocally() the next time
 * they're saved/signed/looked up — this script only closes the gap for
 * rows that might never be touched again. Same SUPABASE_SERVICE_ROLE_KEY
 * + raw-fetch-REST pattern as add-transporter-credentials.ts — paste the
 * key in for this one run, never add it to Vercel's environment or any
 * file that gets deployed. Get it from Supabase Dashboard -> Project
 * Settings -> API Keys -> "Secret keys" (sb_secret_...).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-mmin.ts
 */
import { encrypt } from "../src/lib/cryptoUtils";
import { generateVerificationCode } from "../src/lib/verificationCode";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
    process.exit(1);
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  const listRes = await fetch(
    `${supabaseUrl}/rest/v1/manifests?mmin_encrypted=is.null&select=id,epa_mtn`,
    { headers }
  );
  if (!listRes.ok) {
    console.error(`Failed to list manifests (${listRes.status}): ${await listRes.text()}`);
    process.exit(1);
  }

  const rows: { id: string; epa_mtn: string }[] = await listRes.json();
  console.log(`${rows.length} manifest(s) need an MMIN.`);

  let failed = 0;
  for (const row of rows) {
    const res = await fetch(`${supabaseUrl}/rest/v1/manifests?id=eq.${row.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ mmin_encrypted: encrypt(generateVerificationCode()) }),
    });
    if (!res.ok) {
      console.error(`Failed for ${row.epa_mtn} (${res.status}): ${await res.text()}`);
      failed++;
      continue;
    }
    console.log(`✅ ${row.epa_mtn}`);
  }

  console.log(`Done. ${rows.length - failed}/${rows.length} succeeded.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
