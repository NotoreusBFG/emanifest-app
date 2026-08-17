"use client";

import { useState } from "react";
import { revokeTransporterAction, unrevokeTransporterAction } from "@/app/actions/transporterRegistrationActions";
import type { TransporterManagementSession } from "@/services/transporterRegistrationRepository";
import { primaryButtonStyle } from "@/lib/formStyles";

export function ManageTransporterForm({
  managementToken,
  session,
}: {
  managementToken: string;
  session: TransporterManagementSession;
}) {
  const [revoked, setRevoked] = useState(session.revokedAt !== null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const handleToggle = async () => {
    setToggling(true);
    setToggleError(null);
    const state = revoked ? await unrevokeTransporterAction(managementToken) : await revokeTransporterAction(managementToken);
    setToggling(false);
    if (state.success) {
      setRevoked(!revoked);
    } else {
      setToggleError(state.error);
    }
  };

  return (
    <div>
      <p style={{ fontSize: "14px", color: "#333" }}>
        <strong>{session.companyName ?? session.epaSiteId}</strong> ({session.epaSiteId})
      </p>
      <p style={{ fontSize: "12px", color: "#888" }}>
        Anyone holding this link can act on it — there&apos;s no login involved. Don&apos;t share it outside
        your company.
      </p>

      <div
        style={{
          marginTop: "16px",
          padding: "10px",
          background: revoked ? "#fdeaea" : "#eaf7ea",
          borderRadius: "4px",
        }}
      >
        <p style={{ fontSize: "14px", margin: 0 }}>
          {revoked
            ? "Signing access is currently revoked. No driver can sign a manifest for this company until you reactivate it."
            : "Signing access is currently active. Any ManifestMate customer you ship for can text a driver to sign for you."}
        </p>
        <button
          type="button"
          disabled={toggling}
          onClick={handleToggle}
          style={{ ...primaryButtonStyle(toggling), marginTop: "10px" }}
        >
          {toggling ? "Working…" : revoked ? "Reactivate" : "Revoke access"}
        </button>
        {toggleError && <p style={{ color: "red", fontSize: "13px", marginTop: "8px" }}>❌ {toggleError}</p>}
      </div>
    </div>
  );
}
