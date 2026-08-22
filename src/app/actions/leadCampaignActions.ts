"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { currentOrigin } from "@/app/actions/driverSignActions";
import { listCampaignRecipients, addLeadActivity } from "@/services/leadsRepository";
import { sendMarketingEmails } from "@/lib/email/resendMarketingClient";

// CAN-SPAM requires a physical mailing address in every marketing email.
// See private-notes/marketing/channels/email-marketing.md for the rest of
// the compliance checklist this footer satisfies (accurate from address,
// non-deceptive subject is on the sender to write, working opt-out link).
const MAILING_ADDRESS = "ManifestMate\n11366 Caruthers Way, Glen Allen, VA 23059";

export type SendCampaignResult = {
  sent: number;
  skipped: number;
  failed: { to: string; error: string }[];
};

export async function sendLeadCampaignAction(
  leadIds: string[],
  subject: string,
  body: string
): Promise<SendCampaignResult> {
  const { supabase } = await requireAdmin();

  if (!subject.trim() || !body.trim()) {
    throw new Error("Subject and body are required");
  }
  if (leadIds.length === 0) {
    throw new Error("No recipients selected");
  }

  // Re-fetches fresh rows and drops anything without an email, removed,
  // or already unsubscribed -- never trust the client-side selection alone
  // for something that sends real email.
  const recipients = await listCampaignRecipients(supabase, leadIds);
  const skipped = leadIds.length - recipients.length;

  const origin = await currentOrigin();

  const emails = recipients.map((lead) => {
    const unsubscribeUrl = `${origin}/unsubscribe/${lead.id}`;
    return {
      leadId: lead.id,
      to: lead.email as string,
      subject,
      body: `${body}\n\n—\n${MAILING_ADDRESS}\n\nDon't want these emails? Unsubscribe: ${unsubscribeUrl}`,
      unsubscribeUrl,
    };
  });

  const result = await sendMarketingEmails(emails);

  const recipientsById = new Map(recipients.map((lead) => [lead.id, lead]));
  await Promise.all(
    result.sentLeadIds.map((leadId) =>
      addLeadActivity(supabase, {
        leadId,
        type: "email",
        subject,
        notes: body,
        completedAt: new Date().toISOString(),
      })
    )
  );

  revalidatePath("/admin/leads");

  return {
    sent: result.sentLeadIds.length,
    skipped,
    failed: result.failed.map((f) => ({ to: recipientsById.get(f.leadId)?.companyName ?? f.to, error: f.error })),
  };
}
