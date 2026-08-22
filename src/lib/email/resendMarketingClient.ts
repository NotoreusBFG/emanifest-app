import { EmailNotConfiguredError } from "./resendClient";

/**
 * Separate from resendClient.ts's sendEmail() on purpose: different sender
 * identity (info@ instead of notifications@ — the lead-tracker's cold
 * outreach shouldn't share a "voice" with transactional signing/signup
 * email), a required List-Unsubscribe header, and Resend's batch endpoint
 * instead of a single send. See private-notes/marketing/channels/
 * email-marketing.md for the CAN-SPAM/sender-identity decisions this
 * follows.
 *
 * Deliberately NOT using Resend Broadcasts/Audiences (the project's Resend
 * skill recommends Broadcasts for marketing sends) — our `leads` table,
 * not a synced Resend Audience, is the source of truth for recipients and
 * opt-out state, and each email needs its own per-recipient
 * unsubscribe-link footer rather than one shared broadcast template.
 * Batch Send is the better fit for that shape.
 *
 * Batch size capped at 50 (Resend's own limit is 100) because a batch
 * call is atomic — one malformed row fails the whole batch — so a smaller
 * chunk keeps the blast radius of any single bad row small.
 */

const BATCH_SIZE = 50;

export type MarketingEmail = {
  // Carried through for result tracking only, never sent to Resend --
  // some leads legitimately share one contact email (e.g. one regional
  // compliance manager across several store locations), so tracking by
  // leadId rather than by "to" address keeps each lead's own activity
  // log entry and send/fail result correct even when addresses collide.
  leadId: string;
  to: string;
  subject: string;
  body: string;
  unsubscribeUrl: string;
};

export type MarketingSendResult = {
  sentLeadIds: string[];
  failed: { leadId: string; to: string; error: string }[];
};

export async function sendMarketingEmails(emails: MarketingEmail[]): Promise<MarketingSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_EMAIL_DOMAIN;
  if (!apiKey || !domain) {
    throw new EmailNotConfiguredError();
  }

  const from = `ManifestMate <info@${domain}>`;
  const result: MarketingSendResult = { sentLeadIds: [], failed: [] };

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        chunk.map((email) => ({
          from,
          to: [email.to],
          subject: email.subject,
          text: email.body,
          headers: {
            "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
          },
        }))
      ),
    });

    if (!res.ok) {
      const detail = await res.text();
      chunk.forEach((email) => result.failed.push({ leadId: email.leadId, to: email.to, error: detail }));
      continue;
    }

    chunk.forEach((email) => result.sentLeadIds.push(email.leadId));
  }

  return result;
}
