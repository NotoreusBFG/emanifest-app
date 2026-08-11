export class SmsNotConfiguredError extends Error {
  constructor() {
    super("SMS sending isn't configured (missing Twilio credentials) — share the link manually instead.");
    this.name = "SmsNotConfiguredError";
  }
}

/**
 * Best-effort US phone normalization to E.164 — Twilio rejects bare
 * 10-digit numbers like "8048362706" with a 400, which previously surfaced
 * to the user as a misleading "SMS isn't configured" (any non-SmsNotConfiguredError
 * failure got that same generic message — see driverSignActions.ts). Not a
 * full international phone validator, just enough for this app's US-only
 * use case today.
 */
function normalizeUsPhoneNumber(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  throw new Error(
    `"${raw}" doesn't look like a valid phone number — use a 10-digit US number or full +1 format.`
  );
}

/**
 * Direct Twilio REST integration — no SMS provider exists in Vercel's
 * Marketplace (checked via `vercel integration discover`; only Resend for
 * email is listed there), so this talks to Twilio directly rather than
 * through marketplace-provisioned env vars, and isn't a dependency —
 * a single REST call doesn't need the `twilio` npm package. Twilio isn't
 * free-tier; callers should treat SmsNotConfiguredError as an expected,
 * handled case (fall back to sharing the link manually), not a bug.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    throw new SmsNotConfiguredError();
  }

  const normalizedTo = normalizeUsPhoneNumber(to);
  // Every message_sample registered with Twilio's A2P 10DLC campaign ends
  // with this line — the campaign was rejected once already (error 30896)
  // for a compliance story that didn't match what the app actually sends,
  // so this appends it centrally rather than trusting every call site to
  // repeat it verbatim.
  const fullBody = `${body} Reply STOP to opt out.`;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: normalizedTo, From: fromNumber, Body: fullBody }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio send failed (${res.status}): ${detail}`);
  }
}
