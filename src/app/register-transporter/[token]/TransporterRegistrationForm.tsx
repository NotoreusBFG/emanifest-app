"use client";

import { useState } from "react";
import { completeTransporterRegistrationAction } from "@/app/actions/transporterRegistrationActions";
import type { TransporterRegistrationSession } from "@/services/transporterRegistrationRepository";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";

export function TransporterRegistrationForm({
  token,
  session,
}: {
  token: string;
  session: TransporterRegistrationSession;
}) {
  const [companyName, setCompanyName] = useState(session.companyNameSnapshot ?? "");
  const [apiId, setApiId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [manageLink, setManageLink] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setResult(null);
    const state = await completeTransporterRegistrationAction({
      token,
      companyName: companyName.trim(),
      apiId: apiId.trim(),
      apiKey: apiKey.trim(),
    });
    setSubmitting(false);
    if (state.success) {
      setResult({ success: true, message: "You're registered." });
      setManageLink(state.manageLink);
    } else {
      setResult({ success: false, message: state.error });
    }
  };

  if (result?.success) {
    return (
      <div>
        <p style={{ color: "green", fontSize: "15px" }}>✅ {result.message}</p>
        <p style={{ fontSize: "13px", color: "#333", marginTop: "10px" }}>
          Save this link — it lets you revoke access anytime, with no login required:
        </p>
        <p style={{ fontSize: "13px", wordBreak: "break-all" }}>
          <a href={manageLink ?? "#"}>{manageLink}</a>
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: "14px", color: "#333" }}>
        Register <strong>{session.companyNameSnapshot ?? "your company"}</strong> with ManifestMate so your
        drivers can sign hazardous waste manifests electronically.
      </p>

      <div style={{ marginTop: "16px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Company name</label>
        <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginTop: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>EPA Site ID</label>
        <input value={session.epaSiteId} disabled style={{ ...inputStyle, background: "#f5f5f5", color: "#666" }} />
        <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
          This comes from the shipment that invited you. If it looks wrong, contact the company that invited
          you before registering — ManifestMate can&apos;t verify this on its own.
        </p>
      </div>

      <div style={{ marginTop: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>RCRAInfo API ID</label>
        <input value={apiId} onChange={(e) => setApiId(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginTop: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>RCRAInfo API Key</label>
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={inputStyle} />
      </div>

      <div
        style={{
          marginTop: "16px",
          padding: "10px",
          background: "#f7f7f7",
          borderRadius: "4px",
          fontSize: "13px",
          color: "#333",
        }}
      >
        <p>
          Before you register: ManifestMate isn&apos;t exclusive to the company that invited you. Once you
          finish registering, that company — and any other company that uses ManifestMate and lists{" "}
          <strong>{companyName || "your company"}</strong> as a transporter on one of their hazardous waste
          manifests — will be able to text a link to one of your drivers to sign on your behalf, using the
          RCRAInfo credentials you provide below. That&apos;s because RCRAInfo doesn&apos;t offer a way to
          scope one transporter&apos;s credentials to a single customer relationship, and ManifestMate keeps
          one shared record per transporter rather than a separate copy per generator. You can revoke this
          access at any time, for everyone, using the link we&apos;ll send you once you&apos;re registered.
        </p>
        <p style={{ marginTop: "8px" }}>
          ManifestMate has no way to confirm that the credentials you enter above actually belong to the
          exact site this invitation names — that check happens on EPA&apos;s side, at the moment a driver
          actually signs, not here. Make sure the API ID and Key are your own company&apos;s, generated in
          your own RCRAInfo account.
        </p>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          fontSize: "14px",
          cursor: "pointer",
          marginTop: "16px",
        }}
      >
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          style={{ marginTop: "3px" }}
        />
        I have read and understand the above, and I&apos;m authorized to register{" "}
        {companyName || "this company"} with ManifestMate.
      </label>

      <button
        type="button"
        disabled={!acknowledged || submitting}
        onClick={handleSubmit}
        style={{ ...primaryButtonStyle(!acknowledged || submitting), marginTop: "16px" }}
      >
        {submitting ? "Registering…" : "Register"}
      </button>

      {result && !result.success && <p style={{ color: "red", marginTop: "10px" }}>❌ {result.message}</p>}
    </div>
  );
}
