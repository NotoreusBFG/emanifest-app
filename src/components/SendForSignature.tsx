"use client";

import { useEffect, useState } from "react";
import { brand, brandGradient } from "@/lib/brandColors";
import { inputStyle } from "@/lib/formStyles";
import {
  createDriverSignLinkAction,
  getManifestTransportersForSendAction,
} from "@/app/actions/driverSignActions";
import { createGeneratorSignLinkAction } from "@/app/actions/generatorSignActions";
import { createWasteLineEditLinkAction } from "@/app/actions/wasteLineEditActions";
import {
  createTransporterRegistrationInviteAction,
  hasPendingTransporterInviteAction,
} from "@/app/actions/transporterRegistrationActions";

type Panel = "share" | "generator" | "transporter" | "wasteLines" | null;

/**
 * Single "Send for signature" entry point, replacing the previous
 * separate SendSignLink.tsx / InviteGeneratorSigner.tsx buttons — those
 * two similarly-named, similarly-styled buttons were easy to confuse.
 * Grouped by intent instead:
 *
 * - "Share a link" — a login-required deep link (Copy/Email) for someone
 *   who'll sign in themselves (or accept a Quick-Sign delegate invite)
 *   and pick their own role. Role-agnostic.
 * - "Invite without an account" — the accountless, one-time,
 *   per-manifest SMS/email signing flows, split by role:
 *   - As Generator: uses the OWNER'S OWN credentials (generatorSignActions.ts)
 *   - As Transporter: uses a third-party transporter's on-file
 *     credentials (driverSignActions.ts)
 *
 * Takes only `mtn` — both createDriverSignLinkAction and
 * createGeneratorSignLinkAction do their own live RCRAInfo re-fetch
 * internally now, so this component works identically on the Dashboard
 * (which only ever has the local mirror's mtn) and the manifest detail
 * page (which has a full live Manifest already, but re-fetching on this
 * infrequent, deliberate action is negligible cost and guarantees
 * freshness either way).
 */
export function SendForSignature({ mtn }: { mtn: string }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [copied, setCopied] = useState(false);

  const link = typeof window !== "undefined" ? `${window.location.origin}/manifests?mtn=${encodeURIComponent(mtn)}` : "";
  const shareMessage = `You have a manifest to review and sign in ManifestMate (${mtn}): ${link}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={outlineButtonStyle}>
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
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setPanel(panel === "share" ? null : "share")}
          style={panel === "share" ? primaryToggleStyle : outlineButtonStyle}
        >
          Share a link
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "generator" ? null : "generator")}
          style={panel === "generator" ? primaryToggleStyle : outlineButtonStyle}
        >
          Send to delegate
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "transporter" ? null : "transporter")}
          style={panel === "transporter" ? primaryToggleStyle : outlineButtonStyle}
        >
          Send to driver
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "wasteLines" ? null : "wasteLines")}
          style={panel === "wasteLines" ? primaryToggleStyle : outlineButtonStyle}
        >
          Add waste lines
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPanel(null);
          }}
          style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "12px" }}
        >
          Close
        </button>
      </div>

      {panel === "share" && (
        <SharePanel mtn={mtn} link={link} shareMessage={shareMessage} copied={copied} onCopy={handleCopy} />
      )}
      {panel === "generator" && <InviteGeneratorPanel mtn={mtn} />}
      {panel === "transporter" && <InviteTransporterPanel mtn={mtn} />}
      {panel === "wasteLines" && <AddWasteLinesPanel mtn={mtn} />}
    </div>
  );
}

const outlineButtonStyle: React.CSSProperties = {
  background: "none",
  border: `1px solid ${brand.blue}`,
  color: brand.blue,
  borderRadius: "4px",
  padding: "5px 10px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

const primaryToggleStyle: React.CSSProperties = {
  padding: "5px 10px",
  background: brandGradient,
  color: "white",
  border: "none",
  borderRadius: "4px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

/** A login-required deep link — the recipient signs in (or accepts a Quick-Sign delegate invite) and picks their own role. Role-agnostic, no live data needed. */
function SharePanel({
  mtn,
  link,
  shareMessage,
  copied,
  onCopy,
}: {
  mtn: string;
  link: string;
  shareMessage: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div style={{ marginTop: "10px", borderTop: `1px solid ${brand.tint}`, paddingTop: "10px" }}>
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
          onClick={onCopy}
          style={{ background: "none", border: "none", color: brand.blue, cursor: "pointer", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <a
        href={`mailto:?subject=${encodeURIComponent(`Manifest ${mtn} needs your signature`)}&body=${encodeURIComponent(shareMessage)}`}
        style={{ display: "inline-block", padding: "6px 12px", background: brandGradient, color: "white", borderRadius: "4px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}
      >
        Email it
      </a>
    </div>
  );
}

/** Accountless, one-time Generator-role signing — uses the owner's own RCRAInfo credentials (generatorSignActions.ts). No live data needed up front; the action does its own live re-fetch. */
function InviteGeneratorPanel({ mtn }: { mtn: string }) {
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
    const state = await createGeneratorSignLinkAction(mtn, phone.trim() || null, email.trim() || null);
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

  return (
    <div style={{ marginTop: "10px", borderTop: `1px solid ${brand.tint}`, paddingTop: "10px" }}>
      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 8px" }}>
        They&apos;ll sign using <strong>your</strong> RCRAInfo credentials — no account needed on their
        end. One-time, for this manifest only.
      </p>
      <FieldRow label="Phone number" value={phone} onChange={setPhone} placeholder="555 555 5555" type="tel" />
      <FieldRow label="Email address" value={email} onChange={setEmail} placeholder="name@example.com" />
      <SendRow sending={sending} onSend={handleSend} label="Send" />
      <ResultDisplay result={result} />
    </div>
  );
}

/** Accountless, one-time waste-line-only edit — the manifest's own MMIN gates it (not a separately-generated code), so no code is returned/shown here; the sender relays the MMIN already visible on the manifest's dashboard card. */
function AddWasteLinesPanel({ mtn }: { mtn: string }) {
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
    const state = await createWasteLineEditLinkAction(mtn, phone.trim() || null, email.trim() || null);
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

  return (
    <div style={{ marginTop: "10px", borderTop: `1px solid ${brand.tint}`, paddingTop: "10px" }}>
      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 8px" }}>
        They can add waste line details using <strong>your</strong> RCRAInfo credentials — no account
        needed, and they can&apos;t change the generator, transporter, or disposal facility. Give them
        this manifest&apos;s MMIN (shown on its dashboard card) separately — it&apos;s not included in
        the message.
      </p>
      <FieldRow label="Phone number" value={phone} onChange={setPhone} placeholder="555 555 5555" type="tel" />
      <FieldRow label="Email address" value={email} onChange={setEmail} placeholder="name@example.com" />
      <SendRow sending={sending} onSend={handleSend} label="Send" />
      <ResultDisplay result={result} />
    </div>
  );
}

/** Accountless, one-time Transporter-role signing — uses that transporter's on-file credentials (driverSignActions.ts). Needs the live transporter list for the picker, fetched on demand. */
function InviteTransporterPanel({ mtn }: { mtn: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transporters, setTransporters] = useState<{ epaSiteId: string; name: string; order: number }[]>([]);
  const [transporterOrder, setTransporterOrder] = useState<number>(1);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; link?: string } | null>(null);
  const [notRegistered, setNotRegistered] = useState<{ epaSiteId: string; name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getManifestTransportersForSendAction(mtn).then((state) => {
      if (cancelled) return;
      setLoading(false);
      if (state.success) {
        setTransporters(state.transporters);
        setTransporterOrder(state.transporters[0]?.order ?? 1);
      } else {
        setLoadError(state.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mtn]);

  const handleSend = async () => {
    if (!phone.trim()) {
      setResult({ success: false, message: "Enter the driver's phone number first." });
      return;
    }
    setSending(true);
    setResult(null);
    setNotRegistered(null);
    const state = await createDriverSignLinkAction(mtn, transporterOrder, phone.trim());
    setSending(false);
    if (state.success) {
      setResult({
        success: true,
        message: state.smsSent
          ? "Text sent to the driver."
          : `Link created, but the text couldn't be sent (${state.smsError ?? "unknown reason"}) — share this link manually:`,
        link: state.smsSent ? undefined : state.link,
      });
    } else if (state.notRegistered && state.transporterEpaSiteId) {
      setNotRegistered({ epaSiteId: state.transporterEpaSiteId, name: state.transporterName ?? state.transporterEpaSiteId });
    } else {
      setResult({ success: false, message: state.error });
    }
  };

  if (loading) {
    return <p style={{ fontSize: "12px", color: "#888", marginTop: "10px" }}>Loading transporters…</p>;
  }
  if (loadError) {
    return <p style={{ fontSize: "12px", color: "red", marginTop: "10px" }}>{loadError}</p>;
  }
  if (transporters.length === 0) {
    return <p style={{ fontSize: "12px", color: "#888", marginTop: "10px" }}>No transporters on this manifest.</p>;
  }

  return (
    <div style={{ marginTop: "10px", borderTop: `1px solid ${brand.tint}`, paddingTop: "10px" }}>
      {transporters.length > 1 && (
        <div style={{ marginBottom: "8px" }}>
          <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "4px" }}>
            Transporter
          </label>
          <select
            value={transporterOrder}
            onChange={(e) => setTransporterOrder(Number(e.target.value))}
            style={{ ...inputStyle, fontSize: "13px" }}
          >
            {transporters.map((t) => (
              <option key={t.epaSiteId} value={t.order}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <FieldRow label="Driver's phone number" value={phone} onChange={setPhone} placeholder="555 555 5555" type="tel" />
      <SendRow sending={sending} onSend={handleSend} label="Send" />
      <ResultDisplay result={result} />
      {notRegistered && (
        <RegisterTransporterCta
          mtn={mtn}
          transporterOrder={transporterOrder}
          epaSiteId={notRegistered.epaSiteId}
          name={notRegistered.name}
        />
      )}
    </div>
  );
}

/**
 * Shown in place of a dead-end error when a picked transporter isn't in
 * `transporters` yet — was previously just a plain red line with no
 * follow-up action. Checks hasPendingTransporterInviteAction first so a
 * generator who already sent an invite sees that, not the same raw form
 * again with no memory of what they already did.
 */
function RegisterTransporterCta({
  mtn,
  transporterOrder,
  epaSiteId,
  name,
}: {
  mtn: string;
  transporterOrder: number;
  epaSiteId: string;
  name: string;
}) {
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; link?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasPendingTransporterInviteAction(epaSiteId).then((hasPending) => {
      if (!cancelled) {
        setPending(hasPending);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [epaSiteId]);

  const handleSend = async () => {
    if (!phone.trim() && !email.trim()) {
      setResult({ success: false, message: "Enter a phone number and/or an email address first." });
      return;
    }
    setSending(true);
    setResult(null);
    const state = await createTransporterRegistrationInviteAction(mtn, transporterOrder, phone.trim() || null, email.trim() || null);
    setSending(false);
    if (state.success) {
      const sentVia = [state.smsSent && "text", state.emailSent && "email"].filter(Boolean).join(" and ");
      setResult({
        success: true,
        message: sentVia
          ? `Registration invite sent via ${sentVia}. Once ${name} completes it, you'll be able to text a driver from them to sign.`
          : `Link created, but nothing could be sent (${state.smsError ?? state.emailError ?? "channel not configured"}) — share this link manually:`,
        link: sentVia ? undefined : state.link,
      });
      setPending(true);
    } else {
      setResult({ success: false, message: state.error });
    }
  };

  return (
    <div style={{ marginTop: "10px", padding: "8px", background: "#fff8ec", borderRadius: "4px" }}>
      {checking ? (
        <p style={{ fontSize: "12px", color: "#888" }}>Checking registration status…</p>
      ) : pending && !result?.success ? (
        <p style={{ fontSize: "12px", color: "#666" }}>
          A registration invite to <strong>{name}</strong> is already pending — waiting for them to complete
          it. You can resend below if needed.
        </p>
      ) : (
        <p style={{ fontSize: "12px", color: "#666" }}>
          <strong>{name}</strong> isn&apos;t set up for SMS signing yet — invite them to register.
        </p>
      )}
      {!result?.success && (
        <>
          <FieldRow label="Phone number" value={phone} onChange={setPhone} placeholder="555 555 5555" type="tel" />
          <FieldRow label="Email address" value={email} onChange={setEmail} placeholder="name@example.com" />
          <SendRow sending={sending} onSend={handleSend} label={pending ? "Resend" : "Send"} />
        </>
      )}
      <ResultDisplay result={result} />
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "4px" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, fontSize: "13px" }}
      />
    </div>
  );
}

function SendRow({ sending, onSend, label }: { sending: boolean; onSend: () => void; label: string }) {
  return (
    <button
      type="button"
      disabled={sending}
      onClick={onSend}
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
      {sending ? "Sending…" : label}
    </button>
  );
}

function ResultDisplay({ result }: { result: { success: boolean; message: string; link?: string } | null }) {
  if (!result) return null;
  return (
    <>
      <p style={{ fontSize: "12px", color: result.success ? "green" : "red", marginTop: "8px" }}>
        {result.success ? "✅" : "❌"} {result.message}
      </p>
      {result.link && (
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
    </>
  );
}
