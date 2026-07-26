"use client";

import { useState } from "react";
import { brand, brandGradient } from "@/lib/brandColors";

/**
 * "Send for signature" — a shareable deep link to a specific manifest
 * (reuses the existing /manifests?mtn=... deep link, same one the dashboard
 * already links through), with one-tap mailto:/sms: handoffs to the site
 * manager's own mail/messaging apps. No email or SMS provider is configured
 * in this project (see docs/delegate-quick-sign-design.md), so this doesn't
 * send anything itself — it hands off to apps the site manager already has,
 * the same pragmatic workaround used for delegate invite links.
 *
 * The link itself doesn't bypass login — /manifests is a protected route,
 * so an unauthenticated recipient is sent to /login first and returned here
 * afterward (see the `next` handling in middleware.ts/authActions.ts).
 */
export function SendSignLink({ mtn }: { mtn: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const link =
    typeof window !== "undefined" ? `${window.location.origin}/manifests?mtn=${encodeURIComponent(mtn)}` : "";
  const message = `You have a manifest to review and sign in ManifestMate (${mtn}): ${link}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
      <div style={{ display: "flex", gap: "10px" }}>
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
        <a
          href={`sms:?body=${encodeURIComponent(message)}`}
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
          Text it
        </a>
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
    </div>
  );
}
