import type { LeadStatus } from "@/services/leadsRepository";
import type { BadgeVariant } from "@/components/ui/Badge";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  callback: "Callback",
  interested: "Interested",
  converted: "Converted",
  not_interested: "Not interested",
  do_not_contact: "Do not contact",
};

export const LEAD_STATUS_VARIANTS: Record<LeadStatus, BadgeVariant> = {
  new: "lead_new",
  contacted: "lead_contacted",
  callback: "lead_callback",
  interested: "lead_interested",
  converted: "lead_converted",
  not_interested: "lead_not_interested",
  do_not_contact: "lead_do_not_contact",
};
