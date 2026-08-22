"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { unsubscribeLeadEmail } from "@/services/leadsRepository";

// Deliberately NOT admin-gated -- this is the public-facing action behind
// the unsubscribe link in a marketing email, called by an anonymous
// recipient. Safe because unsubscribe_lead_email() (the RPC this calls)
// only ever sets one column for the given id, never reads/returns data.
export async function confirmUnsubscribeAction(formData: FormData) {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) throw new Error("Missing lead id");

  const supabase = await createClient();
  await unsubscribeLeadEmail(supabase, leadId);
  redirect(`/unsubscribe/${leadId}?done=1`);
}
