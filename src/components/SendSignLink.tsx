"use client";

import { useState } from "react";
import { brand, brandGradient } from "@/lib/brandColors";
import { inputStyle } from "@/lib/formStyles";
import type { Manifest } from "@/lib/rcrainfo/types";
import { createDriverSignLinkAction } from "@/app/actions/driverSignActions";

/**
 * "Send for signature" — a shareable deep link to a specific manifest
 * (reuses the existing /manifests?mtn=... deep link, same one the dashboard
 * already links through), with one-tap copy/mailto: handoffs to apps the
 * site manager already has. No email provider is configured in this
 * project (see docs/delegate-quick-sign-design.md), so "Email it" doesn't
 * send anything itself — it hands off the same way the old "Text it" used
 * to for SMS.
 *
 * "Text it" has been REPLACED with "Text to driver" — instead of just
 * opening the site manager's own messaging app (which does nothing useful
 * on a desktop browser, and still required the recipient to log in), this
 * now actually sends a real SMS via Twilio (see driverSignActions.ts) to a
 * driver who needs no ManifestMate account at all. Only available when the
 * caller passes `manifest` (the manifest detail page has one; the
 * dashboard's mtn-only cards and the post-create page don't, since they'd
 * need a live transporter list to offer this).
 *
 * The plain link itself doesn't bypass login — /manifests is a protected
 * route, so an unauthenticated recipient is sent to /login first and
 * returned here afterward (see the `next` handling in
 * middleware.ts/authActions.ts). The driver-texting link (/sign/[token])
 * is the one exception — deliberately public, see driverSignActions.ts.
 */
export function SendSignLink({ mtn, manifest }: { mtn: string; manifest?: Manifest }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [texting, setTexting] = useState(false);
  const [transporterOrder, setTransporterOrder] = useState<number>(manifest?.transporters[0]?.order ?? 1);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [textResult, setTextResult] = useState<{ success: boolean; message: string; link?: string } | null>(
    null
  );

  const link =
    typeof window !== "undefined" ? `${window.location.origin}/manifests?mtn=${encodeURIComponent(mtn)}` : "";
  const message = `You have a manifest to review and sign in ManifestMate (${mtn}): ${link}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendText = async () => {
    if (!manifest) return;
    if (!phone.trim()) {
      setTextResult({ success: false, message: "Enter the driver's phone number first." });
      return;
    }
    setSending(true);
    setTextResult(null);
    const state = await createDriverSignLinkAction(manifest, transporterOrder, phone.trim());
    setSending(false);
    if (state.success) {
      setTextResult({
        success: true,
        message: state.smsSent
          ? "Text sent to the driver."
          : `Link created, but the text couldn't be sent (${state.smsError ?? "unknown reason"}) — share this link manually:`,
        link: state.smsSent ? undefined : state.link,
      });
    } else {
      setTextResult({ success: false, message: state.error });
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
        Send for signature
      </button>
    );
  }

  const canTextDriver = !!manifest && manifest.transporters.length > 0;

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
        Anyone with this link still needs to sign in (or accept a Quick-Sign delegate invite) to
        actually view or sign it — sharing the link alone doesn&apos;t grant access.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <code
          style={{
            fontSize: "11px",
            color: "#888",
            wordBreak: "break-all",
            background: "#f5f5f5",
            padding: "2px 5px",
            borderRadius: "3px",
            flex: 1,
          }}
        >
          {link}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: "none",
            border: "none",
            color: brand.blue,
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <a
          href={`mailto:?subject=${encodeURIComponent(
            `Manifest ${mtn} needs your signature`
          )}&body=${encodeURIComponent(message)}`}
          style={{
            display: "inline-block",
            padding: "6px 12px",
            background: brandGradient,
            color: "white",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Email it
        </a>
        {canTextDriver && (
          <button
            type="button"
            onClick={() => setTexting((t) => !t)}
            style={{
              padding: "6px 12px",
              background: brandGradient,
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Text to driver
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Close
        </button>
      </div>

      {texting && manifest && (
        <div
          style={{
            marginTop: "10px",
            borderTop: `1px solid ${brand.tint}`,
            paddingTop: "10px",
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
          <button
            type="button"
            disabled={sending}
            onClick={handleSendText}
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
          {textResult && (
            <p style={{ fontSize: "12px", color: textResult.success ? "green" : "red", marginTop: "8px" }}>
              {textResult.success ? "✅" : "❌"} {textResult.message}
            </p>
          )}
          {textResult?.link && (
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
              {textResult.link}
            </code>
          )}
        </div>
      )}
    </div>
  );
}
