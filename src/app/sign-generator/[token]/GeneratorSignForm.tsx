"use client";

import { useState } from "react";
import { submitGeneratorSignAction } from "@/app/actions/generatorSignActions";
import type { GeneratorSignSession } from "@/services/generatorSignRepository";
import { certificationTextFor } from "@/lib/rcrainfo/certificationText";
import { CertificationDisplay } from "@/components/CertificationDisplay";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";

/**
 * The Generator's certification (certificationTextFor("Generator")) is
 * the one EPA form language that's real, quoted, and first-person ("I
 * hereby declare... I certify...") with no "on behalf of" framing baked
 * into the text itself — unlike Transporter's paraphrase, which already
 * says "on behalf of the transporter named above." Without an explicit
 * acknowledgment here, a signer could plausibly not realize whose legal
 * identity they're exercising, since the account owner's own RCRAInfo
 * credentials are what actually signs. The checkbox below names the
 * generator entity explicitly for that reason.
 */
export function GeneratorSignForm({ token, session }: { token: string; session: GeneratorSignSession }) {
  const [signerName, setSignerName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const certification = certificationTextFor("Generator");
  const generatorName = session.generatorName ?? "the generator";

  const handleSubmit = async () => {
    if (!signerName.trim()) {
      setResult({ success: false, message: "Enter your name first." });
      return;
    }
    setSubmitting(true);
    setResult(null);
    const state = await submitGeneratorSignAction({ token, signerName: signerName.trim() });
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
        <strong>{generatorName}</strong> is shipping manifest <strong>{session.epaMtn}</strong> to{" "}
        <strong>{session.tsdfName}</strong>, and needs the Generator's certification signed.
      </p>
      {session.wasteLineSummary && (
        <p style={{ fontSize: "13px", color: "#666" }}>{session.wasteLineSummary}</p>
      )}

      <div style={{ marginTop: "16px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
          Your name (required)
        </label>
        <input value={signerName} onChange={(e) => setSignerName(e.target.value)} style={inputStyle} />
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
        <strong>{generatorName}</strong>, as their authorized representative.
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
