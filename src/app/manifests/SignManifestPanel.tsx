"use client";

import { useEffect, useState } from "react";
import { signManifestAction, type SignManifestParams } from "@/app/actions/manifestActions";
import { getMyDelegationStatusAction } from "@/app/actions/delegateActions";
import type { Manifest } from "@/lib/rcrainfo/types";
import { certificationTextFor } from "@/lib/rcrainfo/certificationText";
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
  // Set when a "Sign as X" button is clicked, cleared on cancel/confirm —
  // the actual sign call only fires from the confirmation dialog, never
  // directly from the button click. This is the fix for a real gap: there
  // was previously nothing stopping a misclick (e.g. Transporter instead
  // of Generator) from immediately submitting a real signature to EPA.
  const [confirmingRole, setConfirmingRole] = useState<SignableRole | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  // Only set if the current account is itself an active Quick-Sign
  // delegate for someone else — see docs/delegate-quick-sign-design.md.
  // Purely informational here (the server enforces the real access check);
  // this just makes sure a delegate always sees whose authority they're
  // acting under before they confirm a signature.
  const [delegationOwnerEmail, setDelegationOwnerEmail] = useState<string | null>(null);
  useEffect(() => {
    getMyDelegationStatusAction().then((status) => setDelegationOwnerEmail(status?.ownerEmail ?? null));
  }, []);

  const roles = rolesFor(manifest);

  const requestSign = (role: SignableRole) => {
    if (!printedName.trim()) {
      setResult({ role: role.label, success: false, message: "Enter your printed name first." });
      return;
    }
    setResult(null);
    setAcknowledged(false);
    setConfirmingRole(role);
  };

  const cancelSign = () => {
    setConfirmingRole(null);
    setAcknowledged(false);
  };

  const confirmSign = async () => {
    const role = confirmingRole;
    if (!role) return;

    setConfirmingRole(null);
    setPendingRole(role.label);

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
        (RCRAInfo enforces Generator → Transporter → Designated facility order). Not sure which
        sites you&apos;re authorized for? Check &quot;My Sites&quot; under your account on{" "}
        <a
          href="https://rcrainfopreprod.epa.gov/rcrainfo/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: brand.blue }}
        >
          RCRAInfo
        </a>
        . The example data pre-filled when creating a manifest is placeholder — a role using it
        will only sign successfully if it happens to match a site you&apos;re actually authorized
        for.
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
            onClick={() => requestSign(role)}
            style={{ alignSelf: "flex-start", ...primaryButtonStyle(pendingRole !== null) }}
          >
            {pendingRole === role.label ? "Signing…" : `Sign as ${role.label}`}
          </button>
        ))}
      </div>

      {confirmingRole && (
        <SignConfirmationDialog
          role={confirmingRole}
          acknowledged={acknowledged}
          onAcknowledgedChange={setAcknowledged}
          onCancel={cancelSign}
          onConfirm={confirmSign}
          delegationOwnerEmail={delegationOwnerEmail}
        />
      )}

      {result && (
        <p style={{ color: result.success ? "green" : "red", marginTop: "10px" }}>
          {result.success ? "✅" : "❌"} {result.role}: {result.message}
        </p>
      )}
    </div>
  );
}

/**
 * The "signing your life away" clickwrap — a real gap this closes: nothing
 * previously stopped a misclick from immediately submitting a real
 * signature to EPA. Requires an explicit checkbox acknowledgment of the
 * role-appropriate certification text before "Confirm & sign" is even
 * clickable, for every role, not just Generator (though Generator's is the
 * one with real EPA-quoted certification language).
 */
function SignConfirmationDialog({
  role,
  acknowledged,
  onAcknowledgedChange,
  onCancel,
  onConfirm,
  delegationOwnerEmail,
}: {
  role: SignableRole;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  delegationOwnerEmail: string | null;
}) {
  const certification = certificationTextFor(role.siteType);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(10, 34, 70, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ color: brand.navy, marginTop: 0 }}>Confirm signature — {role.label}</h3>
        <p style={{ fontSize: "13px", color: "#666" }}>
          This submits a real, legally binding electronic signature to EPA&apos;s RCRAInfo system
          and cannot be undone.
        </p>

        {delegationOwnerEmail && (
          <p
            style={{
              fontSize: "13px",
              color: brand.navy,
              backgroundColor: "#fff4d9",
              border: "1px solid #f0d488",
              borderRadius: "6px",
              padding: "10px 12px",
            }}
          >
            You&apos;re signing on behalf of <strong>{delegationOwnerEmail}</strong>, using their
            EPA credentials — EPA&apos;s own record will show them, not you, as the signer.
            ManifestMate separately records that you were the one who triggered this signature.
          </p>
        )}

        <div
          style={{
            backgroundColor: brand.tint,
            borderRadius: "6px",
            padding: "14px",
            margin: "16px 0",
          }}
        >
          <p style={{ fontWeight: 600, color: brand.navy, marginTop: 0, fontSize: "14px" }}>
            {certification.heading}
            {!certification.isVerbatim && (
              <span style={{ fontWeight: 400, color: "#666" }}> (summary of the acknowledgment required by this signature)</span>
            )}
          </p>
          {certification.paragraphs.map((paragraph, i) => (
            <p key={i} style={{ fontSize: "14px", color: "#333", lineHeight: 1.5 }}>
              {paragraph}
            </p>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledgedChange(e.target.checked)}
            style={{ marginTop: "3px" }}
          />
          I have read and agree to the statement above, and I am signing as {role.label}.
        </label>

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              backgroundColor: "white",
              color: brand.blue,
              border: `1px solid ${brand.blue}`,
              borderRadius: "4px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!acknowledged}
            onClick={onConfirm}
            style={{ ...primaryButtonStyle(!acknowledged), padding: "8px 16px" }}
          >
            Confirm &amp; sign
          </button>
        </div>
      </div>
    </div>
  );
}
