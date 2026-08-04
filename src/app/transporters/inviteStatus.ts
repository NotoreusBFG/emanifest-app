import type { BadgeVariant } from "@/components/ui/Badge";
import type { TransporterInviteSummary } from "@/services/transporterRegistrationRepository";

export type InviteStatus = "pending" | "registered" | "revoked" | "expired" | "in_progress" | "cancelled";

export interface InviteStatusInfo {
  variant: BadgeVariant;
  label: string;
  status: InviteStatus;
}

export function deriveInviteStatus(invite: TransporterInviteSummary): InviteStatusInfo {
  if (invite.cancelledAt) {
    return { variant: "rejected", label: "Cancelled", status: "cancelled" };
  }
  if (invite.transporterRevokedAt) {
    return { variant: "rejected", label: "Revoked", status: "revoked" };
  }
  if (invite.transporterCompanyName) {
    return { variant: "received", label: "Registered", status: "registered" };
  }
  if (invite.usedAt) {
    return { variant: "in_transit", label: "Registration in progress", status: "in_progress" };
  }
  if (new Date(invite.expiresAt) < new Date()) {
    return { variant: "overdue", label: "Invite expired", status: "expired" };
  }
  return { variant: "scheduled", label: "Invited — awaiting registration", status: "pending" };
}
