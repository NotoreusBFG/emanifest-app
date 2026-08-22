"use client";

import { useState, useTransition } from "react";
import type { Lead } from "@/services/leadsRepository";
import { Card } from "@/components/ui/Card";
import { sendLeadCampaignAction, type SendCampaignResult } from "@/app/actions/leadCampaignActions";

// Rough warm-up guidance from private-notes/marketing/channels/
// email-marketing.md: ~50-100/day in week 1 for a marketing identity with
// no sending history yet. This is a soft warning, not a hard cap -- the
// list is still small enough that a real send rarely needs to cross it.
const WARM_UP_WARNING_THRESHOLD = 100;

export function CampaignComposer({ leads }: { leads: Lead[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<SendCampaignResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = leads.length > 0 && selected.size === leads.length;
  const canSend = selected.size > 0 && subject.trim().length > 0 && body.trim().length > 0;

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

  const send = () => {
    if (!canSend) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await sendLeadCampaignAction(Array.from(selected), subject, body);
        setResult(res);
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
      <section>
        <div className="flex items-center gap-3 px-1 text-sm text-gray-600">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Select all ({leads.length})
          </label>
          <span>{selected.size} selected</span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(lead.id)}
                onChange={() => toggle(lead.id)}
                className="mt-5 shrink-0"
              />
              <Card className="min-w-0 flex-1 p-4">
                <p className="font-bold text-brand-navy truncate">{lead.companyName}</p>
                <p className="mt-0.5 text-sm text-gray-600 truncate">
                  {[lead.category, lead.city, lead.county].filter(Boolean).join(" · ") || "—"}
                  {lead.contactName ? ` · ${lead.contactName}` : ""} · {lead.email}
                </p>
              </Card>
            </div>
          ))}
        </div>
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className="p-5">
          <h3 className="font-bold text-brand-navy">Compose</h3>
          <div className="mt-3 flex flex-col gap-3">
            <input
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setConfirming(false);
              }}
              placeholder="Subject"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setConfirming(false);
              }}
              rows={12}
              placeholder="Email body (plain text) — the mailing address and an unsubscribe link are appended automatically."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />

            {selected.size > WARM_UP_WARNING_THRESHOLD && (
              <p className="text-xs text-amber-600">
                {selected.size} recipients is a large send for a marketing identity with limited sending history —
                consider a smaller batch first. See the warm-up guidance in private-notes.
              </p>
            )}

            <button
              type="button"
              disabled={!canSend || isPending}
              onClick={send}
              className="rounded-full px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90 disabled:opacity-50"
            >
              {isPending
                ? "Sending..."
                : confirming
                  ? `Confirm send to ${selected.size} lead${selected.size === 1 ? "" : "s"}?`
                  : `Send to ${selected.size} lead${selected.size === 1 ? "" : "s"}`}
            </button>
            {confirming && !isPending && (
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="self-start text-xs text-gray-500 hover:underline"
              >
                Cancel
              </button>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {result && (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                Sent {result.sent}. {result.skipped > 0 && `Skipped ${result.skipped} (no email/unsubscribed). `}
                {result.failed.length > 0 && `Failed: ${result.failed.map((f) => f.to).join(", ")}.`}
              </div>
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}
