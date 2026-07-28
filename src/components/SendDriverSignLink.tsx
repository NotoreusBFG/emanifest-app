"use client";

import { useState } from "react";
import type { Manifest } from "@/lib/rcrainfo/types";
import { createDriverSignLinkAction } from "@/app/actions/driverSignActions";
import { brand, brandGradient } from "@/lib/brandColors";
import { inputStyle } from "@/lib/formStyles";

/**
 * Automated counterpart to SendSignLink.tsx's manual "Text it" hand-off —
 * this actually sends an SMS (via Twilio, see src/lib/sms/twilioClient.ts)
 * to a specific driver's phone, with a link to /sign/[token] that needs no
 * ManifestMate account. Deliberately a separate component, not a
 * modification of SendSignLink — that one's `/manifests?mtn=...` link
 * requires login and is the wrong link for an accountless driver.
 *
 * Only works for transporters already set up for SMS signing (Phase 1:
 * admin-provisioned via scripts/add-transporter-credentials.ts — no
 * self-serve registration yet). There's no cheap way to pre-check "on
 * file" status per transporter without an extra round trip, so this just
 * attempts the send and surfaces createDriverSignLinkAction's error
 * message if that transporter isn't set up.
 */
export function SendDriverSignLink({ manifest }: { manifest: Manifest }) {
  const [open, setOpen] = useState(false);
  const [transporterOrder, setTransporterOrder] = useState<number>(manifest.transporters[0]?.order ?? 1);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; link?: string } | null>(null);

  if (manifest.transporters.length === 0) return null;

  const handleSend = async () => {
    if (!phone.trim()) {
      setResult({ success: false, message: "Enter the driver's phone number first." });
      return;
    }
    setSending(true);
    setResult(null);
    const state = await createDriverSignLinkAction(manifest, transporterOrder, phone.trim());
    setSending(false);
    if (state.success) {
      setResult({
        success: true,
        message: state.smsSent
          ? "Text sent to the driver."
          : "Link created, but the text couldn't be sent (SMS isn't configured) — share this link manually:",
        link: state.smsSent ? undefined : state.link,
      });
    } else {
      setResult({ success: false, message: state.error });
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: `1px solid ${brand.blue}`,
          color: brand.blue,
          borderRadius: "4px",
          padding: "5px 10px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Text driver to sign
      </button>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${brand.tint}`,
        borderRadius: "6px",
        padding: "10px 12px",
        marginTop: "6px",
        maxWidth: "420px",
      }}
    >
      {manifest.transporters.length > 1 && (
        <div style={{ marginBottom: "8px" }}>
          <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "4px" }}>
            Transporter
          </label>
          <select
            value={transporterOrder}
            onChange={(e) => setTransporterOrder(Number(e.target.value))}
            style={{ ...inputStyle, fontSize: "13px" }}
          >
            {manifest.transporters.map((t, i) => (
              <option key={t.epaSiteId} value={t.order ?? i + 1}>
                {t.name || t.epaSiteId}
              </option>
            ))}
          </select>
        </div>
      )}
      <div style={{ marginBottom: "8px" }}>
        <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "4px" }}>
          Driver&apos;s phone number
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 555 5555"
          style={{ ...inputStyle, fontSize: "13px" }}
        />
      </div>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button
          type="button"
          disabled={sending}
          onClick={handleSend}
          style={{
            padding: "6px 12px",
            background: brandGradient,
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: sending ? "default" : "pointer",
            opacity: sending ? 0.6 : 1,
          }}
        >
          {sending ? "Sending…" : "Send text"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
          style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "12px" }}
        >
          Close
        </button>
      </div>
      {result && (
        <p style={{ fontSize: "12px", color: result.success ? "green" : "red", marginTop: "8px" }}>
          {result.success ? "✅" : "❌"} {result.message}
        </p>
      )}
      {result?.link && (
        <code
          style={{
            display: "block",
            fontSize: "11px",
            color: "#888",
            wordBreak: "break-all",
            background: "#f5f5f5",
            padding: "4px 6px",
            borderRadius: "3px",
            marginTop: "4px",
          }}
        >
          {result.link}
        </code>
      )}
    </div>
  );
}
