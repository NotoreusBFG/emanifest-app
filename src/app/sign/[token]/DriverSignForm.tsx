"use client";

import { useState } from "react";
import { submitDriverSignAction } from "@/app/actions/driverSignActions";
import type { DriverSignSession } from "@/services/driverSignRepository";
import { certificationTextFor } from "@/lib/rcrainfo/certificationText";
import { CertificationDisplay } from "@/components/CertificationDisplay";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";

/**
 * The whole point of this form: a driver with no ManifestMate account can
 * review a manifest and sign as the transporter. Driver Name is required;
 * Driver ID # and Truck # are optional and kept in ManifestMate's own
 * audit trail (signature_consents) for future scrutiny — none of the
 * three are sent to EPA, which only ever receives printedSignatureName
 * (see submitDriverSignAction).
 */
export function DriverSignForm({ token, session }: { token: string; session: DriverSignSession }) {
  const [driverName, setDriverName] = useState("");
  const [driverIdNumber, setDriverIdNumber] = useState("");
  const [truckNumber, setTruckNumber] = useState("");
  const [mmin, setMmin] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const certification = certificationTextFor("Transporter");

  const handleSubmit = async () => {
    if (!driverName.trim()) {
      setResult({ success: false, message: "Enter the driver's name first." });
      return;
    }
    setSubmitting(true);
    setResult(null);
    const state = await submitDriverSignAction({
      token,
      driverName: driverName.trim(),
      driverIdNumber: driverIdNumber.trim() || undefined,
      truckNumber: truckNumber.trim() || undefined,
      mmin: mmin.trim(),
    });
    setSubmitting(false);
    setResult(
      state.success ? { success: true, message: state.message } : { success: false, message: state.error }
    );
  };

  if (result?.success) {
    return <p style={{ color: "green", fontSize: "15px" }}>✅ {result.message}</p>;
  }

  return (
    <div>
      <p style={{ fontSize: "14px", color: "#333" }}>
        <strong>{session.generatorName}</strong> is shipping manifest{" "}
        <strong>{session.epaMtn}</strong> to <strong>{session.tsdfName}</strong>.
      </p>
      {session.wasteLineSummary && (
        <p style={{ fontSize: "13px", color: "#666" }}>{session.wasteLineSummary}</p>
      )}
      {session.transporterCompanyName && (
        <p style={{ fontSize: "14px", color: "#333", marginTop: "10px" }}>
          You are signing as the transporter representing{" "}
          <strong>{session.transporterCompanyName}</strong>. If that&apos;s not your
          company, do not proceed — this link was not intended for you.
        </p>
      )}

      <div style={{ marginTop: "16px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
          Driver name (required)
        </label>
        <input value={driverName} onChange={(e) => setDriverName(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginTop: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
          Driver ID # (optional)
        </label>
        <input
          value={driverIdNumber}
          onChange={(e) => setDriverIdNumber(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ marginTop: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
          Truck # (optional)
        </label>
        <input value={truckNumber} onChange={(e) => setTruckNumber(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginTop: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
          4-digit signing code (required)
        </label>
        <input
          value={mmin}
          onChange={(e) => setMmin(e.target.value)}
          inputMode="numeric"
          maxLength={4}
          style={inputStyle}
        />
        <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
          Ask your dispatcher for this manifest&apos;s 4-digit signing code (MMIN) before signing. This
          confirms the text reached the right company for this specific shipment — it isn&apos;t tied to you
          personally, and it doesn&apos;t replace the name and ID above.
        </p>
      </div>

      <CertificationDisplay certification={certification} />

      <label
        style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "14px", cursor: "pointer" }}
      >
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          style={{ marginTop: "3px" }}
        />
        I have read and agree to the statement above, and I am signing on behalf of{" "}
        {session.transporterCompanyName ?? "the transporter"}.
      </label>

      <button
        type="button"
        disabled={!acknowledged || submitting}
        onClick={handleSubmit}
        style={{ ...primaryButtonStyle(!acknowledged || submitting), marginTop: "16px" }}
      >
        {submitting ? "Signing…" : "Confirm & sign"}
      </button>

      {result && !result.success && <p style={{ color: "red", marginTop: "10px" }}>❌ {result.message}</p>}
    </div>
  );
}
