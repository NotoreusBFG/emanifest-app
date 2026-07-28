"use client";

import { useState } from "react";
import type { Manifest } from "@/lib/rcrainfo/types";
import { createGeneratorSignLinkAction } from "@/app/actions/generatorSignActions";
import { brand, brandGradient } from "@/lib/brandColors";
import { inputStyle } from "@/lib/formStyles";

/**
 * Deliberately separate from SendSignLink.tsx: that component shares a
 * link to someone ELSE's signing action (a transporter's driver, or a
 * plain login-required deep link). This one delegates the OWNER'S OWN
 * signing authority for the Generator role, using the owner's own
 * RCRAInfo credentials — different enough semantically to keep visually
 * distinct, even though the underlying mechanics (SMS/email, no account,
 * one-time per-manifest token) closely mirror the driver-sign flow.
 */
export function InviteGeneratorSigner({ manifest }: { manifest: Manifest }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; link?: string } | null>(null);

  const handleSend = async () => {
    if (!phone.trim() && !email.trim()) {
      setResult({ success: false, message: "Enter a phone number and/or an email address first." });
      return;
    }
    setSending(true);
    setResult(null);
    const state = await createGeneratorSignLinkAction(manifest, phone.trim() || null, email.trim() || null);
    setSending(false);
    if (state.success) {
      const sentVia = [state.smsSent && "text", state.emailSent && "email"].filter(Boolean).join(" and ");
      setResult({
        success: true,
        message: sentVia
          ? `Sent via ${sentVia}.`
          : `Link created, but nothing could be sent (${state.smsError ?? state.emailError ?? "channel not configured"}) — share this link manually:`,
        link: sentVia ? undefined : state.link,
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
        Invite someone to sign as generator
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
      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 8px" }}>
        They&apos;ll sign using <strong>your</strong> RCRAInfo credentials — no account needed on their
        end. One-time, for this manifest only.
      </p>
      <div style={{ marginBottom: "8px" }}>
        <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "4px" }}>
          Phone number
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 555 5555"
          style={{ ...inputStyle, fontSize: "13px" }}
        />
      </div>
      <div style={{ marginBottom: "8px" }}>
        <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "4px" }}>
          Email address
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
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
          {sending ? "Sending…" : "Send invite"}
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
