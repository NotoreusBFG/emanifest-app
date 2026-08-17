/**
 * LOCAL-ONLY admin tool — not deployed, never run by the app itself.
 * Resets a transporter's driver-signing PIN directly (only pin_hash —
 * leaves epa_api_id/epa_api_key untouched), for when the PIN is forgotten
 * and there's no self-serve "forgot PIN" flow yet. Same
 * SUPABASE_SERVICE_ROLE_KEY pattern as add-transporter-credentials.ts —
 * paste it in for this one run, never add it to Vercel's environment or
 * any file that gets deployed. Get it from Supabase Dashboard -> Project
 * Settings -> API Keys -> "Secret keys" (sb_secret_...).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/reset-transporter-pin.ts <epaSiteId> <newPin>
 */
import { hashPin } from "../src/lib/pinUtils";

async function main() {
  const [epaSiteId, pin] = process.argv.slice(2);
  if (!epaSiteId || !pin || !/^\d{4,6}$/.test(pin)) {
    console.error("Usage: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/reset-transporter-pin.ts <epaSiteId> <newPin (4-6 digits)>");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
    process.exit(1);
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/transporters?epa_site_id=eq.${encodeURIComponent(epaSiteId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ pin_hash: await hashPin(pin), pin_set_at: new Date().toISOString() }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error(`Failed to reset PIN (${res.status}): ${detail}`);
    process.exit(1);
  }

  const rows = await res.json();
  if (rows.length === 0) {
    console.error(`No transporter found with epa_site_id "${epaSiteId}".`);
    process.exit(1);
  }

  console.log(`PIN reset for ${rows[0].company_name} (${epaSiteId}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
