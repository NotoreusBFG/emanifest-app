"use client";

import { useState } from "react";
import { signManifestAction, type SignManifestParams } from "@/app/actions/manifestActions";
import type { Manifest } from "@/lib/rcrainfo/types";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";

interface SignableRole {
  label: string;
  siteId: string;
  siteType: SignManifestParams["siteType"];
  transporterOrder?: number;
}

function rolesFor(manifest: Manifest): SignableRole[] {
  const roles: SignableRole[] = [
    {
      label: `Generator (${manifest.generator.name || manifest.generator.epaSiteId})`,
      siteId: manifest.generator.epaSiteId,
      siteType: "Generator",
    },
  ];
  manifest.transporters.forEach((t, i) => {
    roles.push({
      label: `Transporter ${t.order ?? i + 1} (${t.name || t.epaSiteId})`,
      siteId: t.epaSiteId,
      siteType: "Transporter",
      transporterOrder: t.order ?? i + 1,
    });
  });
  roles.push({
    label: `Designated facility (${manifest.designatedFacility.name || manifest.designatedFacility.epaSiteId})`,
    siteId: manifest.designatedFacility.epaSiteId,
    siteType: "Tsdf",
  });
  return roles;
}

/**
 * Exposes RcrainfoClient.signManifest() (quicker-sign) in the app for the
 * first time — previously only exercised via scripts/test-sign-manifest.ts.
 *
 * Deliberately does NOT try to determine from the manifest data which role
 * has already signed or whose "turn" it is — that per-handler signature
 * status isn't cleanly modeled in the `Manifest` type yet (it appears on
 * live GET responses as extra fields like `electronicSignaturesInfo` not
 * currently typed). Instead, all three roles are always offered, and
 * RCRAInfo's own server-side order enforcement (confirmed live: rejects
 * out-of-order or already-signed attempts with a specific error message)
 * is relied on to tell the user when a given button isn't valid yet — the
 * same error surface already used everywhere else in this app.
 */
export function SignManifestPanel({
  manifest,
  onSigned,
}: {
  manifest: Manifest;
  onSigned: () => void;
}) {
  const [printedName, setPrintedName] = useState("");
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [result, setResult] = useState<{ role: string; success: boolean; message: string } | null>(
    null
  );

  const roles = rolesFor(manifest);

  const handleSign = async (role: SignableRole) => {
    if (!printedName.trim()) {
      setResult({ role: role.label, success: false, message: "Enter your printed name first." });
      return;
    }
    setPendingRole(role.label);
    setResult(null);

    const state = await signManifestAction({
      manifestTrackingNumber: manifest.manifestTrackingNumber,
      siteId: role.siteId,
      siteType: role.siteType,
      transporterOrder: role.transporterOrder,
      printedSignatureName: printedName.trim(),
    });

    setPendingRole(null);
    if (state.success) {
      setResult({ role: role.label, success: true, message: state.message });
      onSigned();
    } else {
      setResult({ role: role.label, success: false, message: state.error });
    }
  };

  return (
    <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: `1px solid ${brand.tint}` }}>
      <h3 style={{ color: brand.navy, marginBottom: "8px" }}>Sign this manifest</h3>
      <p style={{ fontSize: "13px", color: "#666", marginBottom: "10px" }}>
        Your account needs Site Services Permission for whichever site you sign as — signing
        fails with a clear error if it doesn&apos;t, or if it&apos;s not that role&apos;s turn yet
        (RCRAInfo enforces Generator → Transporter → Designated facility order).
      </p>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
          Your printed name
        </label>
        <input
          value={printedName}
          onChange={(e) => setPrintedName(e.target.value)}
          style={{ ...inputStyle, maxWidth: "300px" }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {roles.map((role) => (
          <button
            key={role.label}
            type="button"
            disabled={pendingRole !== null}
            onClick={() => handleSign(role)}
            style={{ alignSelf: "flex-start", ...primaryButtonStyle(pendingRole !== null) }}
          >
            {pendingRole === role.label ? "Signing…" : `Sign as ${role.label}`}
          </button>
        ))}
      </div>

      {result && (
        <p style={{ color: result.success ? "green" : "red", marginTop: "10px" }}>
          {result.success ? "✅" : "❌"} {result.role}: {result.message}
        </p>
      )}
    </div>
  );
}
