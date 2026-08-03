/**
 * LOCAL-ONLY admin tool — not deployed, never run by the app itself.
 * Registers (or updates) a transporter's real RCRAInfo API ID/Key in the
 * `transporters` table so the SMS-to-driver signing flow can use them
 * (see src/app/actions/driverSignActions.ts). This is Phase 1's stand-in
 * for self-serve transporter registration (deliberately deferred) — an
 * admin runs this by hand after getting the credentials directly from
 * someone authorized at the transporter (their RCRAInfo API ID/Key,
 * generated in their own MyRCRAInfo account settings).
 *
 * `transporters` has RLS enabled with ZERO client-facing policies (see
 * 20260803_create_transporters.sql) — this script is the one place a
 * Supabase SERVICE ROLE key is used in this whole project, and
 * deliberately only here: paste it in for this one run, never add it to
 * Vercel's environment or any file that gets deployed. Get it from
 * Supabase Dashboard -> Project Settings -> API Keys -> "Secret keys"
 * (sb_secret_... -- this project uses Supabase's newer key naming, not
 * the older "service_role" JWT label).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/add-transporter-credentials.ts \
 *     <epaSiteId> <companyName> <apiId> <apiKey> [--pin <4-6 digits>]
 *
 * --pin is REQUIRED before the PIN-gated driver-signing feature ships (see
 * submitDriverSignAction in src/app/actions/driverSignActions.ts): that
 * code fails CLOSED when a transporter has no pin_hash set, so every
 * Phase-1 row added by this script before the PIN gate existed needs a
 * one-time backfill run with --pin, or their drivers silently lose SMS
 * signing the moment the new code deploys. Omitting --pin on an existing
 * row leaves its current pin_hash untouched (not cleared).
 */
import { encrypt } from "../src/lib/cryptoUtils";
import { hashPin } from "../src/lib/pinUtils";

function extractPinFlag(args: string[]): { rest: string[]; pin: string | null } {
  const idx = args.indexOf("--pin");
  if (idx === -1) return { rest: args, pin: null };
  const pin = args[idx + 1];
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    console.error("--pin requires a 4-6 digit value.");
    process.exit(1);
  }
  return { rest: [...args.slice(0, idx), ...args.slice(idx + 2)], pin };
}

async function main() {
  const { rest, pin } = extractPinFlag(process.argv.slice(2));
  const [epaSiteId, companyName, apiId, apiKey] = rest;
  if (!epaSiteId || !companyName || !apiId || !apiKey) {
    console.error(
      "Usage: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/add-transporter-credentials.ts <epaSiteId> <companyName> <apiId> <apiKey> [--pin <4-6 digits>]"
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
    process.exit(1);
  }

  // Talks to Supabase's REST (PostgREST) API directly rather than via
  // @supabase/supabase-js — that SDK unconditionally spins up a Realtime
  // (WebSocket) client on construction, which throws on Node < 22 without
  // a WebSocket polyfill ("native WebSocket not found") even though this
  // script never touches realtime features. A plain fetch avoids that
  // entirely, matching the rest of this project's preference for direct
  // REST calls over SDKs (see src/lib/sms/twilioClient.ts).
  // `Prefer: resolution=merge-duplicates` + `on_conflict` is PostgREST's
  // upsert -- same effect as the SDK's `.upsert(..., { onConflict })`.
  const res = await fetch(`${supabaseUrl}/rest/v1/transporters?on_conflict=epa_site_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      epa_site_id: epaSiteId,
      company_name: companyName,
      epa_api_id: encrypt(apiId),
      epa_api_key: encrypt(apiKey),
      revoked_at: null,
      ...(pin ? { pin_hash: await hashPin(pin), pin_set_at: new Date().toISOString() } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`Failed to save transporter credentials (${res.status}): ${detail}`);
    process.exit(1);
  }

  console.log(
    `Saved credentials for ${companyName} (${epaSiteId})${pin ? " with a PIN set" : " (no PIN set — driver signing will be blocked until one is)"} — ready for SMS signing.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
