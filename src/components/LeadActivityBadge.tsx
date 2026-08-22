import type { Lead, LeadActivity } from "@/services/leadsRepository";

const ACTIVITY_ICONS: Record<LeadActivity["type"], string> = {
  meeting: "🤝",
  email: "✉️",
  call: "📞",
  visit: "📍",
  note: "📝",
};

const ACTIVITY_LABELS: Record<LeadActivity["type"], string> = {
  meeting: "Meeting",
  email: "Email",
  call: "Call",
  visit: "Visit",
  note: "Note",
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function LeadActivityBadge({ lead, latestActivity }: { lead: Lead; latestActivity?: LeadActivity }) {
  if (lead.status === "not_interested") {
    return (
      <span className="flex items-center gap-1 text-xs text-red-500" title="Marked not interested">
        <span aria-hidden>🚫</span>
        <span>{formatShortDate(lead.updatedAt)}</span>
      </span>
    );
  }

  if (!latestActivity) return null;

  const date = latestActivity.completedAt ?? latestActivity.createdAt;
  return (
    <span className="flex items-center gap-1 text-xs text-gray-400" title={ACTIVITY_LABELS[latestActivity.type]}>
      <span aria-hidden>{ACTIVITY_ICONS[latestActivity.type]}</span>
      <span>{formatShortDate(date)}</span>
    </span>
  );
}
