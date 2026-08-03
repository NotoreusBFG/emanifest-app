import { getTransporterManagementSessionAction } from "@/app/actions/transporterRegistrationActions";
import { ManageTransporterForm } from "./ManageTransporterForm";
import { brand } from "@/lib/brandColors";

/**
 * Public, accountless route — deliberately NOT in middleware.ts's
 * protectedPaths list. Anyone holding this link can revoke/reactivate
 * this transporter's signing access or change its PIN — that's the
 * entire trust model, stated plainly on the page itself, same pattern as
 * every other token-gated route in this app.
 */
export default async function ManageTransporterPage({
  params,
}: {
  params: Promise<{ managementToken: string }>;
}) {
  const { managementToken } = await params;
  const state = await getTransporterManagementSessionAction(managementToken);

  return (
    <Shell>
      {state.success ? (
        <ManageTransporterForm managementToken={managementToken} session={state.session} />
      ) : (
        <p style={{ color: "#666" }}>{state.error}</p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: "480px", margin: "60px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1 style={{ color: brand.navy, fontSize: "22px" }}>Manage your ManifestMate registration</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
        {children}
      </div>
    </div>
  );
}
