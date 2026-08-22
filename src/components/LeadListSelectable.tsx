"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Lead, LeadActivity } from "@/services/leadsRepository";
import { LEAD_STATUS_LABELS as STATUS_LABELS, LEAD_STATUS_VARIANTS as STATUS_VARIANTS } from "@/lib/leadStatus";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LeadActivityBadge } from "@/components/LeadActivityBadge";
import { bulkRemoveLeadsAction, bulkRestoreLeadsAction } from "@/app/actions/leadsActions";

export function LeadListSelectable({
  leads,
  latestActivities,
  mode,
}: {
  leads: Lead[];
  latestActivities: Record<string, LeadActivity>;
  mode: "active" | "removed";
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const allSelected = leads.length > 0 && selected.size === leads.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirming(false);
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
    setConfirming(false);
  };

  const runBulkAction = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (mode === "active" && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "active") await bulkRemoveLeadsAction(ids);
        else await bulkRestoreLeadsAction(ids);
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 px-1 text-sm text-gray-600">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Select all ({leads.length})
        </label>
        {selected.size > 0 && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={runBulkAction}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold text-white ${
                mode === "active" ? "bg-red-600 hover:bg-red-700" : "bg-brand-navy hover:opacity-90"
              } disabled:opacity-50`}
            >
              {isPending
                ? "Working..."
                : confirming
                  ? `Confirm remove ${selected.size} lead${selected.size === 1 ? "" : "s"}?`
                  : mode === "active"
                    ? `Remove ${selected.size} lead${selected.size === 1 ? "" : "s"}`
                    : `Restore ${selected.size} lead${selected.size === 1 ? "" : "s"}`}
            </button>
            {confirming && !isPending && (
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            )}
          </>
        )}
        {confirming && !isPending && mode === "active" && (
          <span className="text-gray-500">Removed leads can be restored later from the Removed view.</span>
        )}
        {error && <span className="text-red-600">{error}</span>}
      </div>

      {leads.map((lead) => (
        <div key={lead.id} className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected.has(lead.id)}
            onChange={() => toggle(lead.id)}
            className="mt-5 shrink-0"
          />
          <Link href={`/admin/leads/${lead.id}`} className="min-w-0 flex-1">
            <Card className="p-4 hover:shadow-[0_2px_14px_rgba(10,34,70,0.12)] transition">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-brand-navy truncate">{lead.companyName}</p>
                  <p className="mt-0.5 text-sm text-gray-600 truncate">
                    {[lead.category, lead.city, lead.county].filter(Boolean).join(" · ") || "—"}
                    {lead.contactName ? ` · ${lead.contactName}${lead.contactTitle ? ` (${lead.contactTitle})` : ""}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <LeadActivityBadge lead={lead} latestActivity={latestActivities[lead.id]} />
                  {lead.eManifestExperience && (
                    <span className="text-xs text-gray-400 uppercase">{lead.eManifestExperience}</span>
                  )}
                  <Badge variant={STATUS_VARIANTS[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      ))}
    </div>
  );
}
