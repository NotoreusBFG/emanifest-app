export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email sending isn't configured (missing Resend credentials) — share the link manually instead.");
    this.name = "EmailNotConfiguredError";
  }
}

/**
 * Direct Resend REST integration — mirrors src/lib/sms/twilioClient.ts's
 * reasoning: a single API call doesn't need the `resend` npm package, and
 * staying dependency-free avoids any repeat of the Node-version/SDK
 * surprises that came up elsewhere in this project (see
 * scripts/add-transporter-credentials.ts's history). No email provider is
 * configured anywhere in this project yet — this needs a real Resend
 * account/API key before it can send anything; callers should treat
 * EmailNotConfiguredError as an expected, handled case, not a bug.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_EMAIL_DOMAIN;
  if (!apiKey || !domain) {
    throw new EmailNotConfiguredError();
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // RESEND_API_KEY/RESEND_EMAIL_DOMAIN both come from the Vercel
      // Marketplace Resend integration (see `vercel integration add
      // resend/resend-email`) -- the domain itself still needs its DNS
      // records verified in Resend before sending actually works;
      // provisioning the integration alone doesn't verify it.
      from: `ManifestMate <notifications@${domain}>`,
      to: [to],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }
}
