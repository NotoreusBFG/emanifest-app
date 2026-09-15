import { getWasteLineEditSessionAction } from "@/app/actions/wasteLineEditActions";
import { EditWasteLinesForm } from "./EditWasteLinesForm";
import { ScanWasteLinesForm } from "./ScanWasteLinesForm";
import { brand } from "@/lib/brandColors";

/**
 * Public, accountless route — deliberately NOT in middleware.ts's
 * protectedPaths list (none of ["/settings","/manifests","/dashboard",
 * "/onboarding","/ldr","/transporters","/transporter-dashboard"] prefix-
 * match "/edit-waste-lines"). Lets a delegate add/edit ONLY a manifest's
 * waste lines using the account owner's own RCRAInfo credentials, no
 * ManifestMate account needed — see
 * src/app/actions/wasteLineEditActions.ts for the security model
 * (token-gated SECURITY DEFINER functions + the manifest's own MMIN, same
 * shape as the sibling /sign-generator/[token] and /sign/[token] flows).
 *
 * Two very different UIs share this one token/session type, picked by
 * `session.via` (set at invite-creation time by which SendForSignature.tsx
 * button was used): "scan" renders the compact, mobile-first
 * ScanWasteLinesForm (header, facility, scan button, list, MMIN, confirm —
 * same shape as /sign/[token]'s DriverSignForm), "manual" renders the full
 * desktop-style EditWasteLinesForm with profile/lab-pack pickers for
 * someone typing everything in by hand.
 */
export default async function EditWasteLinesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await getWasteLineEditSessionAction(token);

  if (!state.success) {
    return (
      <Shell narrow title="Add waste lines — ManifestMate">
        <p style={{ color: "#666" }}>{state.error}</p>
      </Shell>
    );
  }

  if (state.session.via === "scan") {
    return (
      <Shell narrow title="Scan drums — ManifestMate">
        <ScanWasteLinesForm token={token} session={state.session} />
      </Shell>
    );
  }

  return (
    <Shell title="Add waste lines — ManifestMate">
      <EditWasteLinesForm token={token} session={state.session} />
    </Shell>
  );
}

function Shell({ children, narrow, title }: { children: React.ReactNode; narrow?: boolean; title: string }) {
  return (
    <div
      style={{
        maxWidth: narrow ? "480px" : "700px",
        margin: narrow ? "60px auto" : "40px auto",
        fontFamily: "sans-serif",
        padding: "0 16px",
      }}
    >
      <h1 style={{ color: brand.navy, fontSize: "22px" }}>{title}</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
        {children}
      </div>
    </div>
  );
}
