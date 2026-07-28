export class SmsNotConfiguredError extends Error {
  constructor() {
    super("SMS sending isn't configured (missing Twilio credentials) — share the link manually instead.");
    this.name = "SmsNotConfiguredError";
  }
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

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio send failed (${res.status}): ${detail}`);
  }
}
