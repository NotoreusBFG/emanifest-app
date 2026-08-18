import { getWasteLineEditSessionAction } from "@/app/actions/wasteLineEditActions";
import { EditWasteLinesForm } from "./EditWasteLinesForm";
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
 */
export default async function EditWasteLinesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await getWasteLineEditSessionAction(token);

  return (
    <Shell>
      {state.success ? (
        <EditWasteLinesForm token={token} session={state.session} />
      ) : (
        <p style={{ color: "#666" }}>{state.error}</p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1 style={{ color: brand.navy, fontSize: "22px" }}>Add waste lines — ManifestMate</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
        {children}
      </div>
    </div>
  );
}
