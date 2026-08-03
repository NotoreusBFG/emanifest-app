"use client";

import { useState } from "react";
import { createStandaloneTransporterInviteAction } from "@/app/actions/transporterRegistrationActions";
import { SiteSearchField } from "@/app/manifests/new/SiteSearchField";
import type { SiteSearchResultItem } from "@/lib/rcrainfo/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function InviteTransporterForm() {
  const [selectedSite, setSelectedSite] = useState<SiteSearchResultItem | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; link?: string } | null>(null);
  const [alreadyPending, setAlreadyPending] = useState(false);

  const handleSend = async (confirmResend: boolean) => {
    if (!selectedSite) {
      setResult({ success: false, message: "Search for and select a transporter's company first." });
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setResult({ success: false, message: "Enter a phone number and/or an email address." });
      return;
    }
    setSending(true);
    setResult(null);
    setAlreadyPending(false);
    const state = await createStandaloneTransporterInviteAction(
      selectedSite.epaSiteId,
      phone.trim() || null,
      email.trim() || null,
      confirmResend
    );
    setSending(false);
    if (state.success) {
      const sentVia = [state.smsSent && "text", state.emailSent && "email"].filter(Boolean).join(" and ");
      setResult({
        success: true,
        message: sentVia
          ? `Invite sent via ${sentVia}.`
          : `Link created, but nothing could be sent (${state.smsError ?? state.emailError ?? "channel not configured"}) — share this link manually:`,
        link: sentVia ? undefined : state.link,
      });
    } else if (state.alreadyPending) {
      setAlreadyPending(true);
      setResult({ success: false, message: state.error });
    } else {
      setResult({ success: false, message: state.error });
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm text-gray-600">
        Search for a transporter by company name to send them a registration invite — no manifest
        needed.
      </p>

      {selectedSite ? (
        <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="font-semibold text-brand-navy">{selectedSite.name}</p>
          <p className="text-sm text-gray-600">{selectedSite.epaSiteId}</p>
          <button
            type="button"
            onClick={() => setSelectedSite(null)}
            className="mt-1 text-xs text-brand-blue hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <SiteSearchField
          siteType="Transporter"
          placeholder="Search for the transporter's company name..."
          onSelect={setSelectedSite}
        />
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input
          label="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 555 5555"
        />
        <Input
          label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
        />
      </div>

      <Button
        type="button"
        disabled={sending}
        onClick={() => handleSend(false)}
        className="mt-4"
      >
        {sending ? "Sending…" : "Send registration invite"}
      </Button>

      {result && (
        <p className={`mt-3 text-sm ${result.success ? "text-green-700" : "text-red-600"}`}>
          {result.success ? "✅" : "❌"} {result.message}
        </p>
      )}
      {alreadyPending && (
        <Button type="button" variant="secondary" disabled={sending} onClick={() => handleSend(true)} className="mt-2">
          Resend anyway
        </Button>
      )}
      {result?.link && (
        <code className="mt-2 block break-all rounded bg-gray-100 p-2 text-xs text-gray-600">{result.link}</code>
      )}
    </div>
  );
}
